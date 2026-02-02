import type { VoiceDesignInput, VoiceCloneInput, CustomVoiceInput } from "./validators";

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
