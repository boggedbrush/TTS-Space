import { clamp } from "@/lib/utils";

export async function decodeAudioMetadata(blob: Blob) {
    const context = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < channelData.length; i += 1) {
        const value = Math.abs(channelData[i]);
        peak = Math.max(peak, value);
        sum += value * value;
    }
    const rms = Math.sqrt(sum / channelData.length);
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    context.close();
    return { duration, rms, peak, sampleRate };
}

export function computeNormalizationGain(rms: number, targetDb = -16) {
    if (!Number.isFinite(rms) || rms === 0) return 1;
    const target = Math.pow(10, targetDb / 20);
    const gain = target / rms;
    return clamp(gain, 0.2, 6);
}

export async function concatAudioBuffers(buffers: AudioBuffer[], context: AudioContext) {
    if (buffers.length === 0) {
        return context.createBuffer(1, 1, context.sampleRate);
    }
    const sampleRate = buffers[0].sampleRate;
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const output = context.createBuffer(buffers[0].numberOfChannels, totalLength, sampleRate);
    let offset = 0;
    buffers.forEach((buffer) => {
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            output.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length;
    });
    return output;
}

export function encodeWav(audioBuffer: AudioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const buffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i += 1) {
            view.setUint8(offset + i, text.charCodeAt(i));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i += 1) {
        for (let channel = 0; channel < numChannels; channel += 1) {
            const sample = audioBuffer.getChannelData(channel)[i];
            const clamped = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, clamped * 0x7fff, true);
            offset += 2;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
}
