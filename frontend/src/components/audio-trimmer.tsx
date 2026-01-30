"use client";

import * as React from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Play, Pause, Scissors, RotateCcw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, audioBufferToWav } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface AudioTrimmerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audioFile: File | Blob | null;
    onTrim: (trimmedFile: File) => void;
}

export function AudioTrimmer({
    open,
    onOpenChange,
    audioFile,
    onTrim,
}: AudioTrimmerProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const wavesurferRef = React.useRef<WaveSurfer | null>(null);
    const regionsRef = React.useRef<RegionsPlugin | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [regionStart, setRegionStart] = React.useState(0);
    const [regionEnd, setRegionEnd] = React.useState(0);

    // Initialize WaveSurfer
    React.useEffect(() => {
        if (!open || !audioFile || !containerRef.current) return;

        const url = URL.createObjectURL(audioFile);

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: "hsl(262 83% 58%)",
            progressColor: "hsl(330 81% 60%)",
            cursorColor: "hsl(330 81% 60%)",
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 128,
            normalize: true,
            minPxPerSec: 50,
        });

        const wsRegions = RegionsPlugin.create();
        ws.registerPlugin(wsRegions);

        ws.load(url);

        ws.on("ready", () => {
            const dur = ws.getDuration();
            setDuration(dur);
            setRegionEnd(dur);

            // Add a default region covering the whole track
            wsRegions.addRegion({
                start: 0,
                end: dur,
                color: "rgba(236, 72, 153, 0.2)", // Pinkish
                drag: true,
                resize: true,
            });
        });

        ws.on("audioprocess", () => {
            const curr = ws.getCurrentTime();
            setCurrentTime(curr);

            // Loop region logic
            if (regionsRef.current) {
                const regions = regionsRef.current.getRegions();
                if (regions.length > 0) {
                    const region = regions[0];
                    if (curr >= region.end) {
                        ws.seekTo(region.start / ws.getDuration());
                    }
                }
            }
        });

        ws.on("finish", () => {
            setIsPlaying(false);
        });

        wsRegions.on("region-updated", (region) => {
            setRegionStart(region.start);
            setRegionEnd(region.end);
        });

        // Click on waveform seeks
        ws.on("interaction", () => {
            // Optional: handle seek
        });

        wavesurferRef.current = ws;
        regionsRef.current = wsRegions;

        return () => {
            ws.destroy();
            URL.revokeObjectURL(url);
        };
    }, [open, audioFile]);

    const togglePlay = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
            setIsPlaying(wavesurferRef.current.isPlaying());
        }
    };

    // Play ONLY the selected region
    const playRegion = () => {
        if (wavesurferRef.current && regionsRef.current) {
            const regions = regionsRef.current.getRegions();
            if (regions.length > 0) {
                const region = regions[0];
                wavesurferRef.current.seekTo(
                    region.start / wavesurferRef.current.getDuration()
                );
                wavesurferRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleTrim = async () => {
        if (!audioFile || !wavesurferRef.current) return;

        // We need to decode the audio data to buffer
        try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const audioContext = new AudioContext(); // New context for processing
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Calculate start/end frames
            // Safeguard bounds
            const finalStart = Math.max(0, regionStart);
            const finalEnd = Math.min(audioBuffer.duration, regionEnd);

            if (finalEnd <= finalStart) return;

            const sampleRate = audioBuffer.sampleRate;
            const startFrame = Math.floor(finalStart * sampleRate);
            const endFrame = Math.floor(finalEnd * sampleRate);
            const frameCount = endFrame - startFrame;

            const newBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                frameCount,
                sampleRate
            );

            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                const channelData = audioBuffer.getChannelData(i);
                const newChannelData = newBuffer.getChannelData(i);
                // Copy slice
                // Note: Copying might be expensive for large files, but for short clips it's fine
                // Also native subarray is faster but AudioBuffer returns Float32Array
                for (let j = 0; j < frameCount; j++) {
                    newChannelData[j] = channelData[startFrame + j];
                }
            }

            const wavBlob = audioBufferToWav(newBuffer);

            // Preserve original filename if possible, or append -trimmed
            let name = "trimmed-audio.wav";
            if (audioFile instanceof File) {
                const namePart = audioFile.name.replace(/\.[^/.]+$/, "");
                name = `${namePart}-trimmed.wav`;
            }

            const trimmedFile = new File([wavBlob], name, {
                type: "audio/wav",
            });

            onTrim(trimmedFile);
            onOpenChange(false); // Close dialog
        } catch (error) {
            console.error("Error trimming audio:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Trim Audio</DialogTitle>
                    <DialogDescription>
                        Drag the handles to select the part of the audio you want to keep.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div
                        ref={containerRef}
                        className="w-full mb-4 rounded-lg overflow-hidden border bg-muted/30"
                    />

                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <div>
                            Start:{" "}
                            <span className="font-mono text-foreground">
                                {formatDuration(regionStart)}
                            </span>
                        </div>
                        <div>
                            Selected:{" "}
                            <span className="font-mono text-foreground">
                                {formatDuration(regionEnd - regionStart)}
                            </span>
                        </div>
                        <div>
                            End:{" "}
                            <span className="font-mono text-foreground">
                                {formatDuration(regionEnd)}
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={togglePlay}
                            title={isPlaying ? "Pause" : "Play Full"}
                        >
                            {isPlaying ? (
                                <Pause className="h-4 w-4" />
                            ) : (
                                <Play className="h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={playRegion}
                            title="Loop Selection"
                        >
                            <RotateCcw className="h-4 w-4 mr-2" /> Preview Selection
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleTrim}>
                            <Scissors className="h-4 w-4 mr-2" />
                            Trim
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
