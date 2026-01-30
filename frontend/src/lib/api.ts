import type { VoiceDesignInput, VoiceCloneInput, CustomVoiceInput } from "./validators";

// Use the current hostname so clients on LAN can access the backend
// The backend is exposed on port 8000
const getApiBase = () => {
    if (typeof window === "undefined") return "/api";

    // Use explicit API URL if configured (for tunnels/remote)
    // This enables using Cloudflare Tunnels where backend is on a different URL
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
    }

    // Use relative path if proxying through same origin or in Docker
    // This covers production deployments and Docker Compose
    if (window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1") {
        return "/api";
    }

    // Development mode fallback - point to default backend port
    return `http://${window.location.hostname}:8000/api`;
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
