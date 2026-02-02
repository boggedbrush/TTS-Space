export type Mode = "voiceDesign" | "voiceClone" | "customVoice";
export type ModelSize = "0.6B" | "1.7B";

export interface VoiceDesignSettings {
    text: string;
    language: string;
    voiceDescription: string;
}

export interface VoiceCloneSettings {
    targetText: string;
    language: string;
    referenceText?: string;
    xVectorOnly: boolean;
    modelSize: ModelSize;
}

export interface CustomVoiceSettings {
    text: string;
    language: string;
    speaker: string;
    styleInstruction?: string;
    modelSize: ModelSize;
}

export type GenerationSettings =
    | { mode: "voiceDesign"; settings: VoiceDesignSettings }
    | { mode: "voiceClone"; settings: VoiceCloneSettings }
    | { mode: "customVoice"; settings: CustomVoiceSettings };

export interface GenerationResult {
    audioUrl: string;
    audioBlob: Blob;
    duration: number;
    metadata?: Record<string, unknown>;
}

export interface HistoryEntry {
    id: string;
    timestamp: number;
    mode: Mode;
    settings: VoiceDesignSettings | VoiceCloneSettings | CustomVoiceSettings;
    duration: number;
    audioBlob: Blob;
    metadata?: Record<string, unknown>;
}

export interface Preset {
    id: string;
    title: string;
    description: string;
    value: string;
    tag?: string;
}
