"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { Icon } from "@/components/icon";
import { LANGUAGES, MODEL_IDS, MODEL_SIZES } from "@/lib/constants";
import { FormField } from "@/components/form-field";
import { buildGenerationResult, generateVoiceClone, streamVoiceClone } from "@/lib/api";
import { RequestQueue } from "@/lib/queue";
import { decodeAudioMetadata, concatAudioBuffers, encodeWav } from "@/lib/audio";
import { splitTextSmart } from "@/lib/split";
import { GenerationResult, VoiceCloneSettings } from "@/lib/types";
import { ResultCard } from "@/components/result-card";
import { useGenerationGuard } from "@/components/generation-guard";

const schema = z.object({
  targetText: z.string().min(1, "Target text is required"),
  language: z.string(),
  referenceText: z.string().optional(),
  xVectorOnly: z.boolean(),
  modelSize: z.enum(["0.6B", "1.7B"])
});

type FormValues = z.infer<typeof schema>;

interface VoiceCloneFormProps {
  queue: RequestQueue;
  prefill?: VoiceCloneSettings;
  onAddHistory: (settings: VoiceCloneSettings, result: GenerationResult) => void;
  onShare: (settings: VoiceCloneSettings) => void;
  onLanguageChange?: (language: string) => void;
}

export function VoiceCloneForm({
  queue,
  prefill,
  onAddHistory,
  onShare,
  onLanguageChange
}: VoiceCloneFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetText: "",
      language: "Auto",
      referenceText: "",
      xVectorOnly: false,
      modelSize: "1.7B"
    }
  });

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [cancelTask, setCancelTask] = useState<(() => void) | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useGenerationGuard(isGenerating);

  useEffect(() => {
    if (!prefill) return;
    reset(prefill);
  }, [prefill, reset]);

  const languageValue = watch("language");
  useEffect(() => {
    onLanguageChange?.(languageValue);
  }, [languageValue, onLanguageChange]);

  const textValue = watch("targetText");
  const segments = useMemo(() => splitTextSmart(textValue || ""), [textValue]);
  const xVectorOnly = watch("xVectorOnly");

  const handleFile = (file?: File | null) => {
    if (!file) return;
    setReferenceFile(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsGenerating(true);
    setProgress(null);

    if (!referenceFile) {
      setError("Reference audio is required.");
      setIsGenerating(false);
      return;
    }
    if (!values.xVectorOnly && !values.referenceText?.trim()) {
      setError("Reference transcript is required unless x-vector only is enabled.");
      setIsGenerating(false);
      return;
    }

    const task = queue.enqueue(async (signal) => {
      const settings: VoiceCloneSettings = {
        targetText: values.targetText,
        language: values.language,
        referenceText: values.referenceText || undefined,
        xVectorOnly: values.xVectorOnly,
        modelSize: values.modelSize
      };

      const modelId = MODEL_IDS.base[settings.modelSize];
      if (streaming) {
        const collected: Blob[] = [];
        await streamVoiceClone(
          { ...settings, referenceAudio: referenceFile },
          ({ index, total, audio }) => {
            collected[index] = audio;
            setProgress({ current: index + 1, total });
          },
          signal
        );
        const combined = await stitchSegments(collected);
        const audioMeta = await decodeAudioMetadata(combined);
        const final = buildGenerationResult(combined, {
          duration: audioMeta.duration,
          sample_rate: audioMeta.sampleRate,
          mode: "voiceClone",
          model_id: modelId
        });
        return { final, settings };
      }

      const chunks = segments.length ? segments : [values.targetText];
      const blobs: Blob[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const { blob } = await generateVoiceClone(
          {
            ...settings,
            referenceAudio: referenceFile,
            targetText: chunks[i]
          },
          signal
        );
        blobs.push(blob);
        setProgress({ current: i + 1, total: chunks.length });
      }
      const combined = await stitchSegments(blobs);
      const audioMeta = await decodeAudioMetadata(combined);
      const final = buildGenerationResult(combined, {
        duration: audioMeta.duration,
        sample_rate: audioMeta.sampleRate,
        mode: "voiceClone",
        model_id: modelId
      });
      return { final, settings };
    });

    setCancelTask(() => task.cancel);

    try {
      const { final, settings } = await task.promise;
      setResult((prev) => {
        if (prev?.audioUrl) URL.revokeObjectURL(prev.audioUrl);
        return final;
      });
      onAddHistory(settings, final);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setIsGenerating(false);
      setCancelTask(null);
    }
  });

  return (
    <div className="space-y-6">
      <form className="grid gap-5" onSubmit={onSubmit}>
        <FormField label="Reference audio" hint="Upload 10-30 seconds of clean audio">
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-6 text-xs text-muted"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files[0]);
            }}
          >
            <Icon icon={Upload} size={18} />
            <p>{referenceFile ? referenceFile.name : "Drop audio here or click to upload"}</p>
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>
        </FormField>
        <FormField
          label="Reference transcript"
          hint="Required unless x-vector only mode is enabled"
        >
          <textarea
            className="input min-h-[110px]"
            placeholder="Transcript of the reference audio"
            {...register("referenceText")}
            disabled={xVectorOnly}
          />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Language">
            <select className="input" {...register("language")}>
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Model size">
            <select className="input" {...register("modelSize")}>
              {MODEL_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <label className="flex items-center gap-3 text-sm text-muted">
          <input type="checkbox" className="h-4 w-4" {...register("xVectorOnly")} />
          Enable x-vector only (no transcript required, lower quality)
        </label>
        <FormField label="Target text" hint={`${textValue?.length || 0} characters · ${segments.length} segments`}>
          <textarea
            className="input min-h-[140px]"
            placeholder="Enter target text for the cloned voice"
            {...register("targetText")}
          />
          {errors.targetText && <span className="text-xs text-danger">{errors.targetText.message}</span>}
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={isGenerating}>
            {isGenerating ? (
              <Icon icon={Loader2} size={16} className="animate-spin motion-reduce:animate-none" />
            ) : null}
            Generate Voice Clone
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStreaming((prev) => !prev)}
          >
            Streaming {streaming ? "On" : "Off"}
          </button>
          {isGenerating && cancelTask && (
            <button type="button" className="btn-ghost" onClick={() => cancelTask()}>
              Cancel
            </button>
          )}
        </div>
        {progress && (
          <div className="text-xs text-muted">
            Segment {progress.current} of {progress.total}
            <div className="mt-2 h-2 w-full rounded-full bg-baseMuted">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-xs text-danger">
            <Icon icon={AlertTriangle} size={14} />
            {error}
          </div>
        )}
      </form>
      <ResultCard
        result={result}
        isLoading={isGenerating}
        title="Voice Clone Output"
        onShare={() =>
          onShare({
            targetText: watch("targetText"),
            language: watch("language"),
            referenceText: watch("referenceText") || undefined,
            xVectorOnly: watch("xVectorOnly"),
            modelSize: watch("modelSize")
          })
        }
      />
    </div>
  );
}

async function stitchSegments(blobs: Blob[]) {
  if (blobs.length === 1) return blobs[0];
  const context = new AudioContext();
  const buffers = await Promise.all(
    blobs.map(async (blob) => {
      const arrayBuffer = await blob.arrayBuffer();
      return context.decodeAudioData(arrayBuffer.slice(0));
    })
  );
  const merged = await concatAudioBuffers(buffers, context);
  const wavBlob = encodeWav(merged);
  context.close();
  return wavBlob;
}
