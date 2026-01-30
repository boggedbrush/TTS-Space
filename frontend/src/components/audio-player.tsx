"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Download,
    RotateCcw,
    Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, downloadBlob } from "@/lib/utils";

interface AudioPlayerProps {
    audioUrl: string | null;
    audioBlob: Blob | null;
    className?: string;
    onRegenerate?: () => void;
    filename?: string;
}

export function AudioPlayer({
    audioUrl,
    audioBlob,
    className,
    onRegenerate,
    filename = "audio.wav",
}: AudioPlayerProps) {
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const animationRef = React.useRef<number | null>(null);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const analyserRef = React.useRef<AnalyserNode | null>(null);
    const sourceRef = React.useRef<MediaElementAudioSourceNode | null>(null);

    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(1);
    const [isMuted, setIsMuted] = React.useState(false);
    const [playbackRate, setPlaybackRate] = React.useState(1);

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case " ":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "j":
                    if (audioRef.current) {
                        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                    }
                    break;
                case "l":
                    if (audioRef.current) {
                        audioRef.current.currentTime = Math.min(
                            duration,
                            audioRef.current.currentTime + 10
                        );
                    }
                    break;
                case "k":
                    togglePlay();
                    break;
                case "m":
                    toggleMute();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [duration]);

    // Setup audio context and analyser for waveform
    React.useEffect(() => {
        if (!audioRef.current || !canvasRef.current || !audioUrl) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            sourceRef.current = audioContextRef.current.createMediaElementSource(
                audioRef.current
            );
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }

        return () => {
            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [audioUrl]);

    // Draw waveform visualization
    const drawWaveform = React.useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.fillStyle = "hsl(var(--muted) / 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;

            const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, "hsl(262 83% 58%)");
            gradient.addColorStop(1, "hsl(330 81% 60%)");
            ctx.fillStyle = gradient;

            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth + 1;
        }

        if (isPlaying) {
            animationRef.current = requestAnimationFrame(drawWaveform);
        }
    }, [isPlaying]);

    React.useEffect(() => {
        if (isPlaying) {
            drawWaveform();
        } else if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
        }
    }, [isPlaying, drawWaveform]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = percent * duration;
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    const handleDownload = () => {
        if (audioBlob) {
            downloadBlob(audioBlob, filename);
        }
    };

    const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

    const cyclePlaybackRate = () => {
        const currentIndex = playbackRates.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % playbackRates.length;
        const newRate = playbackRates[nextIndex];
        setPlaybackRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    if (!audioUrl) {
        return (
            <div
                className={cn(
                    "rounded-xl border border-dashed border-border/50 bg-card/50 p-8 text-center",
                    className
                )}
            >
                <div className="text-muted-foreground">
                    <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Generate audio to see the player</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "rounded-xl border border-border/50 bg-card/50 backdrop-blur p-4",
                className
            )}
        >
            <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Waveform visualization */}
            <div
                className="relative h-20 w-full rounded-lg overflow-hidden bg-muted/30 mb-4 cursor-pointer"
                onClick={handleSeek}
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    width={800}
                    height={80}
                />
                {/* Progress overlay */}
                <div
                    className="absolute inset-0 bg-primary/10"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                {/* Playhead */}
                <motion.div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                    layoutId="playhead"
                />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="h-12 w-12 rounded-full bg-primary/10 hover:bg-primary/20"
                    aria-label={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? (
                        <Pause className="h-5 w-5" />
                    ) : (
                        <Play className="h-5 w-5 ml-0.5" />
                    )}
                </Button>

                {/* Time display */}
                <div className="flex items-center gap-1 text-sm tabular-nums">
                    <span className="text-foreground">{formatDuration(currentTime)}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{formatDuration(duration)}</span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Playback speed */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={cyclePlaybackRate}
                    className="tabular-nums text-xs"
                    aria-label={`Playback speed: ${playbackRate}x`}
                >
                    {playbackRate}x
                </Button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX className="h-4 w-4" />
                        ) : (
                            <Volume2 className="h-4 w-4" />
                        )}
                    </Button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 accent-primary"
                        aria-label="Volume"
                    />
                </div>

                {/* Regenerate */}
                {onRegenerate && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRegenerate}
                        aria-label="Regenerate"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                )}

                {/* Download */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownload}
                    disabled={!audioBlob}
                    aria-label="Download"
                >
                    <Download className="h-4 w-4" />
                </Button>
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex flex-wrap gap-4">
                <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Space</kbd> Play/Pause
                </span>
                <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">J</kbd> -10s
                </span>
                <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">L</kbd> +10s
                </span>
                <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">M</kbd> Mute
                </span>
            </div>
        </div>
    );
}
