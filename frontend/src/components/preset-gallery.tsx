import { CLONE_GUIDANCE, CUSTOM_VOICE_PRESETS, VOICE_DESIGN_PRESETS } from "@/lib/constants";
import { Mode, Preset } from "@/lib/types";

interface PresetGalleryProps {
  mode: Mode;
  speaker?: string;
  onApply: (value: string) => void;
}

export function PresetGallery({ mode, speaker, onApply }: PresetGalleryProps) {
  let presets: Preset[] = [];
  let title = "Presets";

  if (mode === "voiceDesign") {
    presets = VOICE_DESIGN_PRESETS;
    title = "Voice Design Presets";
  }

  if (mode === "customVoice") {
    presets = speaker ? CUSTOM_VOICE_PRESETS[speaker] || [] : [];
    title = "CustomVoice Styles";
  }

  if (mode === "voiceClone") {
    presets = CLONE_GUIDANCE;
    title = "Clone Guidance";
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-xs text-muted">Curated</span>
      </div>
      <div className="mt-4 grid gap-3">
        {presets.map((preset) => (
          <div key={preset.id} className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-semibold text-foreground">{preset.title}</p>
            <p className="text-xs text-muted">{preset.description}</p>
            {mode !== "voiceClone" && (
              <button
                type="button"
                className="btn-ghost mt-2"
                onClick={() => onApply(preset.value)}
              >
                Use preset
              </button>
            )}
            {mode === "voiceClone" && (
              <p className="mt-2 text-xs text-muted">{preset.value}</p>
            )}
          </div>
        ))}
        {mode === "customVoice" && presets.length === 0 && (
          <p className="text-xs text-muted">Select a speaker to unlock style presets.</p>
        )}
      </div>
    </div>
  );
}
