import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
}

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function splitTextIntoChunks(
    text: string,
    maxChunkLength: number = 200
): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChunkLength) {
            currentChunk += sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve(base64.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function audioBufferToWav(
    buffer: AudioBuffer,
    options: { float32?: boolean } = {}
): Blob {
    const numOfChan = buffer.numberOfChannels;
    const bytesPerSample = options.float32 ? 4 : 2;
    const formatCode = options.float32 ? 3 : 1; // 3 = IEEE float, 1 = PCM
    const length = buffer.length * numOfChan * bytesPerSample + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let sample;
    let dataOffset = 0;
    let headerOffset = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(formatCode); // format
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * bytesPerSample * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * bytesPerSample); // block-align
    setUint16(bytesPerSample * 8); // bits per sample

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - headerOffset - 4); // chunk length

    // write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i += 1) {
        channels.push(buffer.getChannelData(i));
    }

    for (let pos = 0; pos < buffer.length; pos += 1) {
        for (let i = 0; i < numOfChan; i += 1) {
            // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
            if (options.float32) {
                view.setFloat32(44 + dataOffset, sample, true);
                dataOffset += 4;
            } else {
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(44 + dataOffset, sample, true); // write 16-bit sample
                dataOffset += 2;
            }
        }
    }

    // helper functions
    function setUint16(data: number) {
        view.setUint16(headerOffset, data, true);
        headerOffset += 2;
    }

    function setUint32(data: number) {
        view.setUint32(headerOffset, data, true);
        headerOffset += 4;
    }

    return new Blob([bufferArray], { type: "audio/wav" });
}

export async function audioBufferToWavAsync(
    buffer: AudioBuffer,
    options: { float32?: boolean; yieldEveryMs?: number } = {}
): Promise<Blob> {
    const numOfChan = buffer.numberOfChannels;
    const bytesPerSample = options.float32 ? 4 : 2;
    const formatCode = options.float32 ? 3 : 1; // 3 = IEEE float, 1 = PCM
    const length = buffer.length * numOfChan * bytesPerSample + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels: Float32Array[] = [];
    let sample;
    let dataOffset = 0;
    let headerOffset = 0;

    const yieldEveryMs = options.yieldEveryMs ?? 16;
    const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
            ? () => performance.now()
            : () => Date.now();
    const yieldToMain = () =>
        new Promise<void>((resolve) => {
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(() => resolve());
            } else {
                setTimeout(resolve, 0);
            }
        });
    let lastYield = now();

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(formatCode); // format
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * bytesPerSample * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * bytesPerSample); // block-align
    setUint16(bytesPerSample * 8); // bits per sample

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - headerOffset - 4); // chunk length

    // write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i += 1) {
        channels.push(buffer.getChannelData(i));
    }

    for (let pos = 0; pos < buffer.length; pos += 1) {
        for (let i = 0; i < numOfChan; i += 1) {
            // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
            if (options.float32) {
                view.setFloat32(44 + dataOffset, sample, true);
                dataOffset += 4;
            } else {
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(44 + dataOffset, sample, true); // write 16-bit sample
                dataOffset += 2;
            }
        }

        if ((pos & 4095) === 0) {
            const current = now();
            if (current - lastYield >= yieldEveryMs) {
                lastYield = current;
                await yieldToMain();
            }
        }
    }

    // helper functions
    function setUint16(data: number) {
        view.setUint16(headerOffset, data, true);
        headerOffset += 2;
    }

    function setUint32(data: number) {
        view.setUint32(headerOffset, data, true);
        headerOffset += 4;
    }

    return new Blob([bufferArray], { type: "audio/wav" });
}
