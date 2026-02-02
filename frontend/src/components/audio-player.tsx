"use client";

import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { Icon } from "@/components/icon";
import { computeNormalizationGain } from "@/lib/audio";
import { cn, formatDuration } from "@/lib/utils";

export interface AudioPlayerRef {
    play: () => void;
    pause: () => void;
    seekTo: (progress: number) => void;
    getDuration: () => number;
    getCurrentTime: () => number;
    setRate: (rate: number) => void;
}

interface AudioPlayerProps {
    audioUrl?: string | null;
    audioBlob?: Blob | null;
    title?: string;
    className?: string;
    enableNormalization?: boolean;
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
    ({ audioUrl, audioBlob, title, className, enableNormalization = true }, ref) => {
        const containerRef = useRef<HTMLDivElement | null>(null);
        const waveRef = useRef<WaveSurfer | null>(null);
        const [isReady, setIsReady] = useState(false);
        const [isPlaying, setIsPlaying] = useState(false);
        const [currentTime, setCurrentTime] = useState(0);
        const [duration, setDuration] = useState(0);
        const [playbackRate, setPlaybackRate] = useState(1);
        const [loopStart, setLoopStart] = useState<number | null>(null);
        const [loopEnd, setLoopEnd] = useState<number | null>(null);
        const [loopEnabled, setLoopEnabled] = useState(false);
        const [normalizationEnabled, setNormalizationEnabled] = useState(enableNormalization);
        const [targetDb, setTargetDb] = useState(-16);
        const [gain, setGain] = useState(1);
        const [isActive, setIsActive] = useState(false);

        useImperativeHandle(
            ref,
            () => ({
                play: () => waveRef.current?.play(),
                pause: () => waveRef.current?.pause(),
                seekTo: (progress) => waveRef.current?.seekTo(progress),
                getDuration: () => waveRef.current?.getDuration() || 0,
                getCurrentTime: () => waveRef.current?.getCurrentTime() || 0,
                setRate: (rate) => {
                    setPlaybackRate(rate);
                    waveRef.current?.setPlaybackRate(rate);
                },
            }),
            [],
        );

        useEffect(() => {
            if (!containerRef.current) return;
            const wave = WaveSurfer.create({
                container: containerRef.current,
                waveColor: "rgba(125, 211, 252, 0.35)",
                progressColor: "rgba(59, 130, 246, 0.9)",
                cursorColor: "rgba(148, 163, 184, 0.8)",
                barWidth: 2,
                barGap: 2,
                height: 80,
                normalize: false,
                autoCenter: true,
            });
            waveRef.current = wave;

            wave.on("ready", () => {
                setIsReady(true);
                setDuration(wave.getDuration());
                setGain(1);
            });
            wave.on("audioprocess", () => setCurrentTime(wave.getCurrentTime()));
            wave.on("timeupdate", () => setCurrentTime(wave.getCurrentTime()));
            wave.on("play", () => setIsPlaying(true));
            wave.on("pause", () => setIsPlaying(false));
            wave.on("finish", () => setIsPlaying(false));

            return () => {
                wave.destroy();
                waveRef.current = null;
            };
        }, []);

        useEffect(() => {
            if (!audioUrl || !waveRef.current) return;
            setIsReady(false);
            waveRef.current.load(audioUrl);
        }, [audioUrl]);

        useEffect(() => {
            if (!waveRef.current) return;
            waveRef.current.setPlaybackRate(playbackRate);
        }, [playbackRate]);

        useEffect(() => {
            if (!loopEnabled || loopStart === null || loopEnd === null) return;
            const wave = waveRef.current;
            if (!wave) return;
            const handler = () => {
                if (wave.getCurrentTime() >= loopEnd) {
                    wave.setTime(loopStart);
                }
            };
            wave.on("audioprocess", handler);
            return () => {
                wave.un("audioprocess", handler);
            };
        }, [loopEnabled, loopStart, loopEnd]);

        useEffect(() => {
            if (loopStart === null || loopEnd === null) return;
            if (loopStart <= loopEnd) return;
            setLoopStart(loopEnd);
            setLoopEnd(loopStart);
        }, [loopStart, loopEnd]);

        useEffect(() => {
            if (!audioBlob || !normalizationEnabled) {
                waveRef.current?.setVolume(1);
                setGain(1);
                return;
            }
            let cancelled = false;
            audioBlob.arrayBuffer().then((buffer) => {
                const context = new AudioContext();
                context.decodeAudioData(buffer.slice(0)).then((audioBuffer) => {
                    if (cancelled) return;
                    const channel = audioBuffer.getChannelData(0);
                    let sum = 0;
                    for (let i = 0; i < channel.length; i += 1) {
                        sum += channel[i] * channel[i];
                    }
                    const rms = Math.sqrt(sum / channel.length);
                    const computed = computeNormalizationGain(rms, targetDb);
                    setGain(computed);
                    waveRef.current?.setVolume(computed);
                    context.close();
                });
            });
            return () => {
                cancelled = true;
            };
        }, [audioBlob, normalizationEnabled, targetDb]);

        useEffect(() => {
            if (!isActive) return;
            const handler = (event: KeyboardEvent) => {
                if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
                if (event.code === "Space") {
                    event.preventDefault();
                    waveRef.current?.playPause();
                }
                if (event.key.toLowerCase() === "j") {
                    event.preventDefault();
                    waveRef.current?.skip(-10);
                }
                if (event.key.toLowerCase() === "k") {
                    event.preventDefault();
                    waveRef.current?.playPause();
                }
                if (event.key.toLowerCase() === "l") {
                    event.preventDefault();
                    waveRef.current?.skip(10);
                }
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }, [isActive]);

        if (!audioUrl) {
            return (
                <div className={cn("glass rounded-2xl p-6 text-center", className)}>
                    <Volume2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-3 text-sm text-muted">Generate audio to preview the player.</p>
                </div>
            );
        }

        return (
            <div
                className={cn("glass rounded-2xl p-4", className)}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                onFocus={() => setIsActive(true)}
                onBlur={() => setIsActive(false)}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            {title || "Generated audio"}
                        </p>
                        <p className="text-xs text-muted">
                            {formatDuration(currentTime)} / {formatDuration(duration)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="btn-ghost" onClick={() => waveRef.current?.skip(-5)}>
                            <Icon icon={RotateCcw} size={16} />
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => waveRef.current?.playPause()}
                            disabled={!isReady}
                        >
                            {isPlaying ? <Icon icon={Pause} size={16} /> : <Icon icon={Play} size={16} />}
                            {isPlaying ? "Pause" : "Play"}
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => waveRef.current?.skip(5)}>
                            <Icon icon={RotateCw} size={16} />
                        </button>
                    </div>
                </div>

                <div className="mt-4" ref={containerRef} aria-hidden="true" />

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Speed</span>
                        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                            <button
                                key={rate}
                                type="button"
                                className={cn(
                                    "rounded-full border px-3 py-1",
                                    playbackRate === rate
                                        ? "border-accent bg-accent/10 text-foreground"
                                        : "border-border",
                                )}
                                onClick={() => setPlaybackRate(rate)}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Loop</span>
                        <button type="button" className="btn-ghost" onClick={() => setLoopStart(currentTime)}>
                            Set In
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setLoopEnd(currentTime)}>
                            Set Out
                        </button>
                        <button
                            type="button"
                            className={cn(
                                "btn-ghost",
                                loopEnabled ? "bg-accent/20 text-foreground" : "",
                            )}
                            onClick={() => setLoopEnabled((prev) => !prev)}
                            disabled={loopStart === null || loopEnd === null}
                        >
                            Loop {loopEnabled ? "On" : "Off"}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Normalize</span>
                        <button
                            type="button"
                            className={cn(
                                "btn-ghost",
                                normalizationEnabled ? "bg-accent/20 text-foreground" : "",
                            )}
                            onClick={() => setNormalizationEnabled((prev) => !prev)}
                        >
                            {normalizationEnabled ? "On" : "Off"}
                        </button>
                        <input
                            type="number"
                            className="input h-9 w-20 text-xs"
                            min={-24}
                            max={-6}
                            step={1}
                            value={targetDb}
                            onChange={(event) => setTargetDb(Number(event.target.value))}
                            aria-label="Loudness target"
                            disabled={!normalizationEnabled}
                        />
                        <span className="text-[10px]">dB target · gain {gain.toFixed(2)}</span>
                    </div>
                </div>
                <p className="mt-3 text-[10px] text-muted">
                    Hotkeys: Space / J / K / L · Hover player to enable.
                </p>
            </div>
        );
    },
);

AudioPlayer.displayName = "AudioPlayer";
