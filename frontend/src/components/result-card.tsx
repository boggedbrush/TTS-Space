"use client";

import { Download, Link2 } from "lucide-react";
import { Icon } from "@/components/icon";
import { AudioPlayer } from "@/components/audio-player";
import { GenerationResult } from "@/lib/types";

interface ResultCardProps {
  result?: GenerationResult | null;
  title?: string;
  onShare?: () => void;
  isLoading?: boolean;
}

export function ResultCard({ result, title, onShare, isLoading }: ResultCardProps) {
  if (!result && isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton mt-4 h-24" />
        <div className="skeleton mt-4 h-10 w-1/2" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass rounded-2xl p-6">
        <p className="text-sm font-semibold text-foreground">No audio yet</p>
        <p className="mt-2 text-xs text-muted">
          Generate a sample to preview waveform controls, download, and sharing tools.
        </p>
      </div>
    );
  }

  const downloadAudio = () => {
    const url = URL.createObjectURL(result.audioBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "qwen3-tts.wav";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <AudioPlayer
        audioUrl={result.audioUrl}
        audioBlob={result.audioBlob}
        title={title || "Generated audio"}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={downloadAudio}>
          <Icon icon={Download} size={16} />
          Download WAV
        </button>
        {onShare && (
          <button type="button" className="btn-secondary" onClick={onShare}>
            <Icon icon={Link2} size={16} />
            Share settings
          </button>
        )}
        {Boolean(result.metadata?.model_id) && (
          <span className="chip">{String(result.metadata?.model_id)}</span>
        )}
      </div>
    </div>
  );
}
