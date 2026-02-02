import { QUALITY_TIPS, SPEAKER_TIPS } from "@/lib/constants";

interface QualityTipsProps {
  language: string;
  speaker?: string;
}

export function QualityTips({ language, speaker }: QualityTipsProps) {
  const tips = QUALITY_TIPS[language] || QUALITY_TIPS.Auto;
  const speakerTips = speaker ? SPEAKER_TIPS[speaker] || [] : [];
  return (
    <div className="glass rounded-2xl p-4">
      <p className="label">Quality tips</p>
      <ul className="mt-3 space-y-2 text-xs text-muted">
        {tips.map((tip) => (
          <li key={tip}>• {tip}</li>
        ))}
        {speakerTips.map((tip) => (
          <li key={tip}>• {tip}</li>
        ))}
      </ul>
    </div>
  );
}
