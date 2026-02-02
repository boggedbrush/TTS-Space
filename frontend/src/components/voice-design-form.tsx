"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Icon } from "@/components/icon";
import { LANGUAGES, MODEL_IDS } from "@/lib/constants";
import { FormField } from "@/components/form-field";
import { buildGenerationResult, generateVoiceDesign, streamVoiceDesign } from "@/lib/api";
import { RequestQueue } from "@/lib/queue";
import { decodeAudioMetadata, concatAudioBuffers, encodeWav } from "@/lib/audio";
import { splitTextSmart } from "@/lib/split";
import { GenerationResult, VoiceDesignSettings } from "@/lib/types";
import { ResultCard } from "@/components/result-card";

const schema = z.object({
  text: z.string().min(1, "Text is required"),
  language: z.string(),
  voiceDescription: z.string().min(8, "Add a richer voice description")
});

type FormValues = z.infer<typeof schema>;

interface VoiceDesignFormProps {
  queue: RequestQueue;
  prefill?: VoiceDesignSettings;
  onAddHistory: (settings: VoiceDesignSettings, result: GenerationResult) => void;
  onShare: (settings: VoiceDesignSettings) => void;
  preset?: string | null;
  onPresetApplied?: () => void;
  onLanguageChange?: (language: string) => void;
}

export function VoiceDesignForm({
  queue,
  prefill,
  onAddHistory,
  onShare,
  preset,
  onPresetApplied,
  onLanguageChange
}: VoiceDesignFormProps) {
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
      voiceDescription: ""
    }
  });

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [cancelTask, setCancelTask] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!prefill) return;
    reset(prefill);
  }, [prefill, reset]);

  useEffect(() => {
    if (!preset) return;
    setValue("voiceDescription", preset);
    onPresetApplied?.();
  }, [preset, setValue, onPresetApplied]);

  const languageValue = watch("language");
  useEffect(() => {
    onLanguageChange?.(languageValue);
  }, [languageValue, onLanguageChange]);

  const textValue = watch("text");
  const charCount = textValue?.length || 0;
  const segments = useMemo(() => splitTextSmart(textValue || ""), [textValue]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsGenerating(true);
    setProgress(null);

    const task = queue.enqueue(async (signal) => {
      const settings: VoiceDesignSettings = {
        text: values.text,
        language: values.language,
        voiceDescription: values.voiceDescription
      };

      if (streaming) {
        const collected: Blob[] = [];
        await streamVoiceDesign(
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
          mode: "voiceDesign",
          model_id: MODEL_IDS.voiceDesign
        });
        return { final, settings };
      }

      const chunks = segments.length ? segments : [values.text];
      const blobs: Blob[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const { blob } = await generateVoiceDesign(
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
        mode: "voiceDesign",
        model_id: MODEL_IDS.voiceDesign
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
        <FormField label="Text to synthesize" hint={`${charCount} characters · ${segments.length} segments`}
        >
          <textarea
            className="input min-h-[140px]"
            placeholder="Enter narration text"
            {...register("text")}
          />
          {errors.text && <span className="text-xs text-danger">{errors.text.message}</span>}
        </FormField>
        <FormField label="Language">
          <select className="input" {...register("language")}> 
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Voice description" hint="Describe tone, pacing, emotion, or persona">
          <textarea
            className="input min-h-[120px]"
            placeholder="A warm cinematic narrator with slow pacing and crisp diction"
            {...register("voiceDescription")}
          />
          {errors.voiceDescription && (
            <span className="text-xs text-danger">{errors.voiceDescription.message}</span>
          )}
        </FormField>
        <div className="text-xs text-muted">
          Voice Design uses the 1.7B model only for highest fidelity.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={isGenerating}>
            {isGenerating ? (
              <Icon icon={Loader2} size={16} className="animate-spin motion-reduce:animate-none" />
            ) : null}
            Generate Voice Design
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
        title="Voice Design Output"
        onShare={() => onShare({
          text: watch("text"),
          language: watch("language"),
          voiceDescription: watch("voiceDescription")
        })}
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
