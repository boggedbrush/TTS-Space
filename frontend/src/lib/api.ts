import type { VoiceDesignInput, VoiceCloneInput, CustomVoiceInput } from "./validators";
import type { CustomVoiceSettings, VoiceCloneSettings, VoiceDesignSettings } from "./types";
import { base64ToBlob } from "./utils";

const getApiBase = () => {
    if (typeof window === "undefined") return "/api";

    // Use explicit API URL if configured (for tunnels/remote)
    const explicitApiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (explicitApiUrl) {
        return explicitApiUrl.replace(/\/$/, "");
    }

    // Default to same-origin API proxy route
    return "/api";
};

const API_BASE = getApiBase();

export interface GenerationResult {
    audio: Blob;
    duration: number;
    sampleRate: number;
}

export interface APIError {
    message: string;
    detail?: string;
}

class APIClient {
    private abortController: AbortController | null = null;

    async generateVoiceDesign(input: VoiceDesignInput): Promise<GenerationResult> {
        return this.generate(`${API_BASE}/voice-design`, {
            text: input.text,
            language: input.language,
            voice_description: input.voiceDescription,
        });
    }

    async generateVoiceClone(input: VoiceCloneInput): Promise<GenerationResult> {
        const formData = new FormData();
        formData.append("text", input.text);
        formData.append("language", input.language);
        formData.append("model_size", input.modelSize);
        formData.append("x_vector_only", String(input.xVectorOnly));

        if (input.refAudio) {
            formData.append("ref_audio", input.refAudio);
        }
        if (input.refText) {
            formData.append("ref_text", input.refText);
        }

        return this.generateFormData(`${API_BASE}/voice-clone`, formData);
    }

    async generateCustomVoice(input: CustomVoiceInput): Promise<GenerationResult> {
        return this.generate(`${API_BASE}/custom-voice`, {
            text: input.text,
            language: input.language,
            speaker: input.speaker,
            instruct: input.instruct || "",
            model_size: input.modelSize,
        });
    }

    private async generate(url: string, body: Record<string, unknown>): Promise<GenerationResult> {
        this.abortController = new AbortController();

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: this.abortController.signal,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(error.detail || error.message || "Generation failed");
        }

        const audioBlob = await response.blob();
        const duration = parseFloat(response.headers.get("X-Audio-Duration") || "0");
        const sampleRate = parseInt(response.headers.get("X-Sample-Rate") || "24000", 10);

        return { audio: audioBlob, duration, sampleRate };
    }

    private async generateFormData(url: string, formData: FormData): Promise<GenerationResult> {
        this.abortController = new AbortController();

        const response = await fetch(url, {
            method: "POST",
            body: formData,
            signal: this.abortController.signal,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(error.detail || error.message || "Generation failed");
        }

        const audioBlob = await response.blob();
        const duration = parseFloat(response.headers.get("X-Audio-Duration") || "0");
        const sampleRate = parseInt(response.headers.get("X-Sample-Rate") || "24000", 10);

        return { audio: audioBlob, duration, sampleRate };
    }

    cancel(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    async transcribeAudio(audioFile: File | Blob, language?: string): Promise<string> {
        const formData = new FormData();
        formData.append("audio", audioFile);
        if (language && language !== "Auto") {
            formData.append("language", language);
        }

        this.abortController = new AbortController();

        const response = await fetch(`${API_BASE}/transcribe`, {
            method: "POST",
            body: formData,
            signal: this.abortController.signal,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(error.detail || error.message || "Transcription failed");
        }

        const result = await response.json();
        return result.text;
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

export const apiClient = new APIClient();

type Metadata = Record<string, unknown> & { duration?: number; sample_rate?: number };

const parseDurationHeaders = (response: Response): Metadata => {
    const duration = Number(response.headers.get("X-Audio-Duration") || 0);
    const sampleRate = Number(response.headers.get("X-Sample-Rate") || 0);
    return {
        duration,
        sample_rate: sampleRate,
    };
};

export async function generateVoiceDesign(settings: VoiceDesignSettings, signal?: AbortSignal) {
    const response = await fetch(`${API_BASE}/voice-design`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: settings.text,
            language: settings.language,
            voice_description: settings.voiceDescription,
        }),
        signal,
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Voice Design failed");
    }
    const blob = await response.blob();
    const metadata = parseDurationHeaders(response);
    return { blob, metadata };
}

export async function generateVoiceClone(
    settings: VoiceCloneSettings & { referenceAudio: File },
    signal?: AbortSignal,
) {
    const body = new FormData();
    body.append("ref_audio", settings.referenceAudio);
    if (settings.referenceText) body.append("ref_text", settings.referenceText);
    body.append("x_vector_only", String(settings.xVectorOnly));
    body.append("text", settings.targetText);
    body.append("language", settings.language);
    body.append("model_size", settings.modelSize);

    const response = await fetch(`${API_BASE}/voice-clone`, {
        method: "POST",
        body,
        signal,
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Voice Clone failed");
    }
    const blob = await response.blob();
    const metadata = parseDurationHeaders(response);
    return { blob, metadata };
}

export async function generateCustomVoice(settings: CustomVoiceSettings, signal?: AbortSignal) {
    const response = await fetch(`${API_BASE}/custom-voice`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: settings.text,
            language: settings.language,
            speaker: settings.speaker,
            instruct: settings.styleInstruction || "",
            model_size: settings.modelSize,
        }),
        signal,
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "CustomVoice failed");
    }
    const blob = await response.blob();
    const metadata = parseDurationHeaders(response);
    return { blob, metadata };
}

export async function streamVoiceDesign(
    settings: VoiceDesignSettings,
    onSegment: (payload: { index: number; total: number; audio: Blob }) => void,
    signal?: AbortSignal,
) {
    await streamSegments(
        `${API_BASE}/voice-design/stream`,
        {
            text: settings.text,
            language: settings.language,
            voice_description: settings.voiceDescription,
        },
        onSegment,
        signal,
    );
}

export async function streamCustomVoice(
    settings: CustomVoiceSettings,
    onSegment: (payload: { index: number; total: number; audio: Blob }) => void,
    signal?: AbortSignal,
) {
    await streamSegments(
        `${API_BASE}/custom-voice/stream`,
        {
            text: settings.text,
            language: settings.language,
            speaker: settings.speaker,
            instruct: settings.styleInstruction || "",
            model_size: settings.modelSize,
        },
        onSegment,
        signal,
    );
}

export async function streamVoiceClone(
    settings: VoiceCloneSettings & { referenceAudio: File },
    onSegment: (payload: { index: number; total: number; audio: Blob }) => void,
    signal?: AbortSignal,
) {
    const body = new FormData();
    body.append("ref_audio", settings.referenceAudio);
    if (settings.referenceText) body.append("ref_text", settings.referenceText);
    body.append("x_vector_only", String(settings.xVectorOnly));
    body.append("text", settings.targetText);
    body.append("language", settings.language);
    body.append("model_size", settings.modelSize);

    await streamSegments(`${API_BASE}/voice-clone/stream`, body, onSegment, signal);
}

async function streamSegments(
    url: string,
    payload: BodyInit | object,
    onSegment: (payload: { index: number; total: number; audio: Blob }) => void,
    signal?: AbortSignal,
) {
    const response = await fetch(url, {
        method: "POST",
        headers: payload instanceof FormData ? undefined : { "Content-Type": "application/json" },
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
        signal,
    });
    if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(message || "Streaming failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let expectedTotal: number | null = null;
    let received = 0;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
            const raw = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const lines = raw.split("\n");
            const dataLine = lines.find((line) => line.startsWith("data:"));
            if (dataLine) {
                const json = dataLine.replace(/^data:\s*/, "");
                const payload = JSON.parse(json) as {
                    index: number;
                    total: number;
                    audio?: string;
                    error?: string;
                };
                if (payload.error) {
                    await reader.cancel();
                    throw new Error(payload.error);
                }
                if (!payload.audio) {
                    await reader.cancel();
                    throw new Error("Streaming failed: missing audio payload.");
                }
                expectedTotal ??= payload.total;
                received += 1;
                const audioBlob = base64ToBlob(payload.audio, "audio/wav");
                onSegment({ index: payload.index, total: payload.total, audio: audioBlob });
            }
            boundary = buffer.indexOf("\n\n");
        }
    }

    if (expectedTotal !== null && received < expectedTotal) {
        throw new Error("Streaming ended early before all segments completed.");
    }
}

export function buildGenerationResult(blob: Blob, metadata?: Record<string, unknown>) {
    const audioUrl = URL.createObjectURL(blob);
    return {
        audioUrl,
        audioBlob: blob,
        duration: Number(metadata?.duration ?? 0),
        metadata,
    };
}
