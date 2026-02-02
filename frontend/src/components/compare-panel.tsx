"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Play } from "lucide-react";
import { Icon } from "@/components/icon";
import { LANGUAGES, MODEL_IDS, MODEL_SIZES, SPEAKERS } from "@/lib/constants";
import { RequestQueue } from "@/lib/queue";
import { splitTextSmart } from "@/lib/split";
import { decodeAudioMetadata, concatAudioBuffers, encodeWav } from "@/lib/audio";
import { buildGenerationResult, generateCustomVoice, generateVoiceClone, generateVoiceDesign } from "@/lib/api";
import { AudioPlayer, AudioPlayerRef } from "@/components/audio-player";
import { GenerationResult } from "@/lib/types";
import { useGenerationGuard } from "@/components/generation-guard";

const MODE_OPTIONS = [
  { value: "customVoice", label: "CustomVoice" },
  { value: "voiceDesign", label: "Voice Design" },
  { value: "voiceClone", label: "Voice Clone" }
] as const;

type CompareMode = (typeof MODE_OPTIONS)[number]["value"];

interface Variant {
  id: string;
  label: string;
  speaker?: string;
  styleInstruction?: string;
  modelSize?: "0.6B" | "1.7B";
  voiceDescription?: string;
  xVectorOnly?: boolean;
}

interface ComparePanelProps {
  queue: RequestQueue;
  modeOverride?: CompareMode;
  hideModeSelect?: boolean;
  sharedText?: string;
  sharedLanguage?: string;
  sharedReferenceText?: string;
  sharedReferenceFile?: File | null;
  hideSharedFields?: boolean;
  primaryVariant?: Partial<Variant>;
  onGeneratingChange?: (isGenerating: boolean) => void;
  onCancelAvailable?: (cancel: (() => void) | null) => void;
}

export interface ComparePanelHandle {
  generate: () => void;
  cancel: () => void;
}

export const ComparePanel = forwardRef<ComparePanelHandle, ComparePanelProps>(function ComparePanel(
  {
    queue,
    modeOverride,
    hideModeSelect,
    sharedText,
    sharedLanguage,
    sharedReferenceText,
    sharedReferenceFile,
    hideSharedFields,
    primaryVariant,
    onGeneratingChange,
    onCancelAvailable
  },
  ref
) {
  const createId = () => crypto.randomUUID();
  const [mode, setMode] = useState<CompareMode>(modeOverride || "customVoice");
  const [text, setText] = useState(sharedText ?? "");
  const [language, setLanguage] = useState(sharedLanguage ?? "Auto");
  const [referenceText, setReferenceText] = useState(sharedReferenceText ?? "");
  const [referenceFile, setReferenceFile] = useState<File | null>(sharedReferenceFile ?? null);
  const [variants, setVariants] = useState<Variant[]>(() => [
    {
      id: createId(),
      label: "Variant A",
      speaker: "Aiden",
      styleInstruction: "Warm and cinematic",
      modelSize: "1.7B",
      voiceDescription: "A calm, cinematic narrator with controlled pacing",
      xVectorOnly: false,
    },
    {
      id: createId(),
      label: "Variant B",
      speaker: "Serena",
      styleInstruction: "Bright and friendly",
      modelSize: "1.7B",
      voiceDescription: "An upbeat storyteller with friendly energy",
      xVectorOnly: false,
    },
  ]);
  const [results, setResults] = useState<Record<string, GenerationResult>>({});
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cancelTask, setCancelTask] = useState<(() => void) | null>(null);

  useGenerationGuard(isGenerating);

  const playerRefs = useRef<Record<string, AudioPlayerRef | null>>({});

  const segments = useMemo(() => splitTextSmart(text || ""), [text]);

  useEffect(() => {
    if (modeOverride) setMode(modeOverride);
  }, [modeOverride]);

  useEffect(() => {
    if (sharedText !== undefined) setText(sharedText);
  }, [sharedText]);

  useEffect(() => {
    if (sharedLanguage !== undefined) setLanguage(sharedLanguage);
  }, [sharedLanguage]);

  useEffect(() => {
    if (sharedReferenceText !== undefined) setReferenceText(sharedReferenceText);
  }, [sharedReferenceText]);

  useEffect(() => {
    if (sharedReferenceFile !== undefined) setReferenceFile(sharedReferenceFile);
  }, [sharedReferenceFile]);

  const primarySignature = JSON.stringify(primaryVariant ?? {});
  useEffect(() => {
    if (!primaryVariant) return;
    setVariants((prev) => {
      if (prev.length === 0) return prev;
      const nextFirst = { ...prev[0], ...primaryVariant };
      const isSame = Object.keys(nextFirst).every(
        (key) => (nextFirst as Variant)[key as keyof Variant] === (prev[0] as Variant)[key as keyof Variant]
      );
      if (isSame) return prev;
      return [nextFirst, ...prev.slice(1)];
    });
  }, [primarySignature, primaryVariant]);

  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  useEffect(() => {
    onCancelAvailable?.(cancelTask);
  }, [cancelTask, onCancelAvailable]);

  const updateVariant = (id: string, field: keyof Variant, value: string | boolean) => {
    setVariants((prev) =>
      prev.map((variant) => (variant.id === id ? { ...variant, [field]: value } : variant))
    );
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: createId(),
        label: `Variant ${String.fromCharCode(65 + prev.length)}`,
        speaker: SPEAKERS[0],
        styleInstruction: "",
        modelSize: "1.7B",
        voiceDescription: "",
        xVectorOnly: false
      }
    ]);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setError(null);
    setIsGenerating(true);
    setProgress(null);

    if (!text.trim()) {
      setError("Text is required for compare mode.");
      setIsGenerating(false);
      return;
    }

    if (mode === "voiceClone" && !referenceFile) {
      setError("Reference audio is required for voice clone compare.");
      setIsGenerating(false);
      return;
    }

    const task = queue.enqueue(async (signal) => {
      const totalSegments = segments.length || 1;
      const totalRuns = totalSegments * variants.length;
      let completed = 0;
      const nextResults: Record<string, GenerationResult> = {};

      for (const variant of variants) {
        const blobs: Blob[] = [];
        for (let i = 0; i < totalSegments; i += 1) {
          if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
          const chunk = segments.length ? segments[i] : text;
          if (mode === "customVoice") {
            const { blob } = await generateCustomVoice(
              {
                text: chunk,
                language,
                speaker: variant.speaker || SPEAKERS[0],
                styleInstruction: variant.styleInstruction || undefined,
                modelSize: variant.modelSize || "1.7B"
              },
              signal
            );
            blobs.push(blob);
          }
          if (mode === "voiceDesign") {
            const { blob } = await generateVoiceDesign(
              {
                text: chunk,
                language,
                voiceDescription: variant.voiceDescription || ""
              },
              signal
            );
            blobs.push(blob);
          }
          if (mode === "voiceClone") {
            const { blob } = await generateVoiceClone(
              {
                referenceAudio: referenceFile as File,
                targetText: chunk,
                language,
                referenceText: referenceText || undefined,
                xVectorOnly: Boolean(variant.xVectorOnly),
                modelSize: variant.modelSize || "1.7B"
              },
              signal
            );
            blobs.push(blob);
          }
          completed += 1;
          setProgress({ current: completed, total: totalRuns });
        }
        const combined = await stitchSegments(blobs);
        const audioMeta = await decodeAudioMetadata(combined);
        const modelId =
          mode === "customVoice"
            ? MODEL_IDS.custom[variant.modelSize || "1.7B"]
            : mode === "voiceClone"
            ? MODEL_IDS.base[variant.modelSize || "1.7B"]
            : MODEL_IDS.voiceDesign;
        nextResults[variant.id] = buildGenerationResult(combined, {
          duration: audioMeta.duration,
          sample_rate: audioMeta.sampleRate,
          mode,
          model_id: modelId
        });
      }
      return nextResults;
    });

    setCancelTask(() => task.cancel);

    try {
      const nextResults = await task.promise;
      setResults((prev) => {
        Object.values(prev).forEach((result) => {
          if (result?.audioUrl) URL.revokeObjectURL(result.audioUrl);
        });
        return nextResults;
      });
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setIsGenerating(false);
      setCancelTask(null);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      generate: () => {
        void handleGenerate();
      },
      cancel: () => {
        cancelTask?.();
      }
    }),
    [cancelTask, handleGenerate]
  );

  const playAll = () => {
    Object.values(playerRefs.current).forEach((player) => {
      player?.seekTo(0);
    });
    Object.values(playerRefs.current).forEach((player) => {
      player?.play();
    });
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          {!hideModeSelect && (
            <>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Multi Mode
              </label>
              <select
                className="input w-48"
                value={mode}
                onChange={(event) => setMode(event.target.value as CompareMode)}
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={addVariant}>
            <Icon icon={Plus} size={16} />
            Add variant
          </button>
          {isGenerating && cancelTask && (
            <button type="button" className="btn-ghost" onClick={() => cancelTask()}>
              Cancel
            </button>
          )}
        </div>
        {!hideSharedFields && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-muted">
              <span className="label">Text</span>
              <textarea
                className="input min-h-[120px]"
                placeholder="Shared text for all variants"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm text-muted">
                <span className="label">Language</span>
                <select
                  className="input"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "voiceClone" && (
                <>
                  <label className="grid gap-2 text-sm text-muted">
                    <span className="label">Reference transcript</span>
                    <textarea
                      className="input min-h-[100px]"
                      placeholder="Transcript for reference audio"
                      value={referenceText}
                      onChange={(event) => setReferenceText(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-muted">
                    <span className="label">Reference audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="input"
                      onChange={(event) => setReferenceFile(event.target.files?.[0] || null)}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
        {progress && (
          <div className="mt-4 text-xs text-muted">
            Rendering {progress.current} of {progress.total}
            <div className="mt-2 h-2 w-full rounded-full bg-baseMuted">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-danger">
            <Icon icon={AlertTriangle} size={14} />
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {variants.map((variant) => (
          <div key={variant.id} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <input
                className="input w-40 text-sm"
                value={variant.label ?? ""}
                onChange={(event) => updateVariant(variant.id, "label", event.target.value)}
              />
              {results[variant.id] && (
                <button type="button" className="btn-ghost" onClick={playAll}>
                  <Icon icon={Play} size={14} />
                  Play all
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {mode === "customVoice" && (
                <>
                  <label className="grid gap-2 text-xs text-muted">
                    <span className="label">Speaker</span>
                    <select
                      className="input"
                      value={variant.speaker ?? SPEAKERS[0]}
                      onChange={(event) => updateVariant(variant.id, "speaker", event.target.value)}
                    >
                      {SPEAKERS.map((speaker) => (
                        <option key={speaker} value={speaker}>
                          {speaker}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-muted">
                    <span className="label">Style instruction</span>
                    <input
                      className="input"
                      value={variant.styleInstruction ?? ""}
                      onChange={(event) => updateVariant(variant.id, "styleInstruction", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-xs text-muted">
                    <span className="label">Model size</span>
                    <select
                      className="input"
                      value={variant.modelSize ?? "1.7B"}
                      onChange={(event) => updateVariant(variant.id, "modelSize", event.target.value)}
                    >
                      {MODEL_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {mode === "voiceDesign" && (
                <>
                  <label className="grid gap-2 text-xs text-muted">
                    <span className="label">Voice description</span>
                    <textarea
                      className="input min-h-[120px]"
                      value={variant.voiceDescription ?? ""}
                      onChange={(event) => updateVariant(variant.id, "voiceDescription", event.target.value)}
                    />
                  </label>
                </>
              )}
              {mode === "voiceClone" && (
                <>
                  <label className="grid gap-2 text-xs text-muted">
                    <span className="label">Model size</span>
                    <select
                      className="input"
                      value={variant.modelSize ?? "1.7B"}
                      onChange={(event) => updateVariant(variant.id, "modelSize", event.target.value)}
                    >
                      {MODEL_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={Boolean(variant.xVectorOnly)}
                      onChange={(event) => updateVariant(variant.id, "xVectorOnly", event.target.checked)}
                    />
                    x-vector only
                  </label>
                </>
              )}
              {results[variant.id] && (
                <AudioPlayer
                  ref={(ref) => {
                    playerRefs.current[variant.id] = ref;
                  }}
                  audioUrl={results[variant.id].audioUrl}
                  audioBlob={results[variant.id].audioBlob}
                  title={variant.label}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

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
