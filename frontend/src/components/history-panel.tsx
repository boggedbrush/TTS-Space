"use client";

import { Download, RotateCcw, Trash2 } from "lucide-react";
import { Icon } from "@/components/icon";
import { HistoryEntry, Mode } from "@/lib/types";
import { humanizeTimestamp } from "@/lib/utils";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onApply: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const modeLabel: Record<Mode, string> = {
  voiceDesign: "Voice Design",
  voiceClone: "Voice Clone",
  customVoice: "CustomVoice"
};

export function HistoryPanel({ entries, onApply, onDelete, onClear }: HistoryPanelProps) {
  const exportJson = (entry: HistoryEntry) => {
    const blob = new Blob([JSON.stringify(entry.settings, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qwen3-tts-${entry.mode}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportWav = (entry: HistoryEntry) => {
    const url = URL.createObjectURL(entry.audioBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qwen3-tts-${entry.mode}.wav`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">History</p>
          <p className="text-xs text-muted">Stored locally in your browser</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted">
            No generations yet. Your recent outputs will appear here.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">{modeLabel[entry.mode]}</p>
              <span className="text-[11px] text-muted">{humanizeTimestamp(entry.timestamp)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {entry.mode === "voiceDesign" && (entry.settings as any).voiceDescription}
              {entry.mode === "voiceClone" && (entry.settings as any).targetText}
              {entry.mode === "customVoice" && (entry.settings as any).text}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted">
              {(entry.settings as any).language && <span className="chip">{(entry.settings as any).language}</span>}
              {(entry.settings as any).speaker && <span className="chip">{(entry.settings as any).speaker}</span>}
              {entry.duration ? <span className="chip">{entry.duration.toFixed(1)}s</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost" onClick={() => onApply(entry)}>
                <Icon icon={RotateCcw} size={14} />
                Re-run
              </button>
              <button type="button" className="btn-ghost" onClick={() => exportJson(entry)}>
                <Icon icon={Download} size={14} />
                JSON
              </button>
              <button type="button" className="btn-ghost" onClick={() => exportWav(entry)}>
                <Icon icon={Download} size={14} />
                WAV
              </button>
              <button type="button" className="btn-ghost" onClick={() => onDelete(entry.id)}>
                <Icon icon={Trash2} size={14} />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
