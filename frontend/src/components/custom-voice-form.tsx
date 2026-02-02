"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Icon } from "@/components/icon";
import { LANGUAGES, MODEL_IDS, MODEL_SIZES, SPEAKERS } from "@/lib/constants";
import { FormField } from "@/components/form-field";
import { buildGenerationResult, generateCustomVoice, streamCustomVoice } from "@/lib/api";
import { RequestQueue } from "@/lib/queue";
import { decodeAudioMetadata, concatAudioBuffers, encodeWav } from "@/lib/audio";
import { splitTextSmart } from "@/lib/split";
import { GenerationResult, CustomVoiceSettings } from "@/lib/types";
import { ResultCard } from "@/components/result-card";
import { useGenerationGuard } from "@/components/generation-guard";

const schema = z.object({
  text: z.string().min(1, "Text is required"),
  language: z.string(),
  speaker: z.string(),
  styleInstruction: z.string().optional(),
  modelSize: z.enum(["0.6B", "1.7B"])
});

type FormValues = z.infer<typeof schema>;

interface CustomVoiceFormProps {
  queue: RequestQueue;
  prefill?: CustomVoiceSettings;
  onAddHistory: (settings: CustomVoiceSettings, result: GenerationResult) => void;
  onShare: (settings: CustomVoiceSettings) => void;
  preset?: string | null;
  onPresetApplied?: () => void;
  onLanguageChange?: (language: string) => void;
  onSpeakerChange?: (speaker: string) => void;
}

export function CustomVoiceForm({
  queue,
  prefill,
  onAddHistory,
  onShare,
  preset,
  onPresetApplied,
  onLanguageChange,
  onSpeakerChange
}: CustomVoiceFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      text: "",
      language: "Auto",
      speaker: "Aiden",
      styleInstruction: "",
      modelSize: "1.7B"
    }
  });

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [cancelTask, setCancelTask] = useState<(() => void) | null>(null);

  useGenerationGuard(isGenerating);

  useEffect(() => {
    if (!prefill) return;
    reset(prefill);
  }, [prefill, reset]);

  useEffect(() => {
    if (!preset) return;
    setValue("styleInstruction", preset);
    onPresetApplied?.();
  }, [preset, setValue, onPresetApplied]);

  const languageValue = watch("language");
  useEffect(() => {
    onLanguageChange?.(languageValue);
  }, [languageValue, onLanguageChange]);

  const speakerValue = watch("speaker");
  useEffect(() => {
    onSpeakerChange?.(speakerValue);
  }, [speakerValue, onSpeakerChange]);

  const textValue = watch("text");
  const segments = useMemo(() => splitTextSmart(textValue || ""), [textValue]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsGenerating(true);
    setProgress(null);

    const task = queue.enqueue(async (signal) => {
      const settings: CustomVoiceSettings = {
        text: values.text,
        language: values.language,
        speaker: values.speaker,
        styleInstruction: values.styleInstruction || undefined,
        modelSize: values.modelSize
      };

      const modelId = MODEL_IDS.custom[settings.modelSize];
      if (streaming) {
        const collected: Blob[] = [];
        await streamCustomVoice(
          settings,
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
          mode: "customVoice",
          model_id: modelId
        });
        return { final, settings };
      }

      const chunks = segments.length ? segments : [values.text];
      const blobs: Blob[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const { blob } = await generateCustomVoice(
          { ...settings, text: chunks[i] },
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
        mode: "customVoice",
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
        <FormField label="Text to synthesize" hint={`${textValue?.length || 0} characters · ${segments.length} segments`}>
          <textarea
            className="input min-h-[140px]"
            placeholder="Enter your script"
            {...register("text")}
          />
          {errors.text && <span className="text-xs text-danger">{errors.text.message}</span>}
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
          <FormField label="Speaker">
            <select className="input" {...register("speaker")}>
              {SPEAKERS.map((speaker) => (
                <option key={speaker} value={speaker}>
                  {speaker}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Model size">
            <select className="input" {...register("modelSize")}>
              {MODEL_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Style instruction" hint="Optional: add emotion or delivery style">
            <input
              className="input"
              placeholder="Warm, conversational, slightly upbeat"
              {...register("styleInstruction")}
            />
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={isGenerating}>
            {isGenerating ? (
              <Icon icon={Loader2} size={16} className="animate-spin motion-reduce:animate-none" />
            ) : null}
            Generate CustomVoice
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
        title="CustomVoice Output"
        onShare={() =>
          onShare({
            text: watch("text"),
            language: watch("language"),
            speaker: watch("speaker"),
            styleInstruction: watch("styleInstruction") || undefined,
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
