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
    maxDuration?: number;
}

export function AudioTrimmer({
    open,
    onOpenChange,
    audioFile,
    onTrim,
    maxDuration,
}: AudioTrimmerProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const wavesurferRef = React.useRef<WaveSurfer | null>(null);
    const regionsRef = React.useRef<RegionsPlugin | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [regionStart, setRegionStart] = React.useState(0);
    const [regionEnd, setRegionEnd] = React.useState(0);
    const [isWaveReady, setIsWaveReady] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [containerReady, setContainerReady] = React.useState(false);
    const objectUrlRef = React.useRef<string | null>(null);
    const isLoadingRef = React.useRef(false);
    const audioFileRef = React.useRef<File | Blob | null>(audioFile);

    // Callback ref for container with dimension check
    const containerCallback = React.useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (node && node.clientWidth > 0 && node.clientHeight > 0) {
            console.log("[AudioTrimmer] Container ready:", { width: node.clientWidth, height: node.clientHeight });
            setContainerReady(true);
        } else {
            setContainerReady(false);
            // Defensive cleanup for StrictMode unmounts or dialog close
            if (wavesurferRef.current) {
                console.log("[AudioTrimmer] Container gone, cleaning up WaveSurfer");
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
            if (regionsRef.current) {
                regionsRef.current = null;
            }
        }
    }, []);

    // Keep audioFileRef in sync with prop (use layout effect to run before WaveSurfer initialization)
    React.useLayoutEffect(() => {
        console.log("[AudioTrimmer] audioFileRef sync:", audioFile ? `${audioFile instanceof File ? audioFile.name : 'Blob'} (${audioFile.size} bytes)` : null);
        audioFileRef.current = audioFile;
    }, [audioFile]);

    const ensureRegionHandles = React.useCallback(
        (region: { element?: HTMLElement | null }) => {
            if (!region?.element) return;
            const regionEl = region.element;
            regionEl.classList.add("trim-region");

            let startHandle = regionEl.querySelector<HTMLSpanElement>(".trim-handle-start");
            if (!startHandle) {
                startHandle = document.createElement("span");
                startHandle.className = "trim-handle trim-handle-start";
                startHandle.setAttribute("aria-hidden", "true");
                regionEl.appendChild(startHandle);
            }

            let endHandle = regionEl.querySelector<HTMLSpanElement>(".trim-handle-end");
            if (!endHandle) {
                endHandle = document.createElement("span");
                endHandle.className = "trim-handle trim-handle-end";
                endHandle.setAttribute("aria-hidden", "true");
                regionEl.appendChild(endHandle);
            }
        },
        []
    );

    const updateRegionState = React.useCallback(
        (region: { start: number; end: number }) => {
            setRegionStart(region.start);
            setRegionEnd(region.end);
        },
        []
    );

    const loadAudioFile = React.useCallback((file: File | Blob | null) => {
        if (!file) return;
        const ws = wavesurferRef.current;
        if (!ws) {
            console.warn("AudioTrimmer: loadAudioFile called before WaveSurfer ready");
            return;
        }
        setLoadError(null);
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        const objectUrl = URL.createObjectURL(file);
        objectUrlRef.current = objectUrl;
        try {
            ws.load(objectUrl);
        } catch (err) {
            console.error("AudioTrimmer: Load error", err);
            setLoadError("Waveform failed to load. Try reopening the trimmer.");
        }
    }, []);

    // Initialize WaveSurfer (once per open)
    React.useLayoutEffect(() => {
        if (!open || !containerReady || !containerRef.current) return;

        // Avoid re-initializing if already active
        if (wavesurferRef.current) return;

        setIsPlaying(false);
        setDuration(0);
        setRegionStart(0);
        setRegionEnd(0);
        setIsWaveReady(false);
        setLoadError(null);

        let isDestroyed = false;
        let resizeObserver: ResizeObserver | null = null;
        let hasInitialized = false;
        let initFrames = 0;
        const containerEl = containerRef.current;
        const initWhenReady = () => {
            if (!containerEl || isDestroyed || hasInitialized) {
                return;
            }
            if (containerEl.clientWidth === 0 || containerEl.clientHeight === 0) {
                console.log("[AudioTrimmer] Container has zero dimensions:", { width: containerEl.clientWidth, height: containerEl.clientHeight });
                return;
            }
            hasInitialized = true;
            // Disconnect the polling observer - we're done waiting for layout
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            console.log("[AudioTrimmer] Initializing WaveSurfer...");

            try {
                const ws = WaveSurfer.create({
                    container: containerEl,
                    waveColor: "hsl(262 83% 58%)",
                    progressColor: "hsl(330 81% 60%)",
                    cursorColor: "hsl(330 81% 60%)",
                    barWidth: 2,
                    barGap: 1,
                    barRadius: 2,
                    height: 128,
                    normalize: true,
                    backend: "WebAudio",
                });

                const wsRegions = ws.registerPlugin(RegionsPlugin.create());

                const keepSingleRegion = (activeRegion: { id: string }) => {
                    const regions = wsRegions.getRegions();
                    regions.forEach((region) => {
                        if (region.id !== activeRegion.id) {
                            region.remove();
                        }
                    });
                };

                wsRegions.on("region-created", (region) => {
                    keepSingleRegion(region);
                    updateRegionState(region);
                    ensureRegionHandles(region);
                });

                wsRegions.on("region-updated", (region) => {
                    // Enforce max duration if set
                    if (maxDuration && (region.end - region.start) > maxDuration) {
                        // Let's try simpler: directly set end
                        const newEnd = region.start + maxDuration;
                        if (newEnd <= ws.getDuration()) {
                            region.setOptions({ end: newEnd });
                        } else {
                            // partial shift
                            region.setOptions({ start: ws.getDuration() - maxDuration, end: ws.getDuration() });
                        }
                    }
                    updateRegionState(region);
                    ensureRegionHandles(region);
                });

                ws.on("ready", () => {
                    isLoadingRef.current = false;
                    console.log("[AudioTrimmer] WaveSurfer ready event fired, duration:", ws.getDuration());
                    setLoadError(null);
                    const dur = ws.getDuration();
                    setDuration(dur);

                    // Add a default region covering the whole track (or max duration)
                    wsRegions.clearRegions();
                    const initialEnd = maxDuration ? Math.min(dur, maxDuration) : dur;

                    const region = wsRegions.addRegion({
                        start: 0,
                        end: initialEnd,
                        color: "rgba(236, 72, 153, 0.2)", // Pinkish
                        drag: true,
                        resize: true,
                    });
                    updateRegionState(region);
                    ensureRegionHandles(region);
                });

                ws.on("timeupdate", (time) => {
                    const curr = time;
                    // Loop region logic
                    const regions = wsRegions.getRegions();
                    if (regions.length > 0) {
                        const region = regions[0];
                        if (curr >= region.end) {
                            ws.seekTo(region.start / ws.getDuration());
                        }
                    }
                });

                ws.on("finish", () => {
                    setIsPlaying(false);
                });

                ws.on("loading", (percent: number) => {
                    console.log("[AudioTrimmer] Loading progress:", percent + "%");
                });

                ws.on("decode", (duration: number) => {
                    console.log("[AudioTrimmer] Audio decoded, duration:", duration);
                });

                ws.on("error", (err) => {
                    isLoadingRef.current = false;
                    console.error("AudioTrimmer: WaveSurfer error", err);
                    setLoadError("Waveform failed to load. Try reopening the trimmer.");
                    setIsWaveReady(false);
                });

                ws.on("interaction", () => {
                    // Optional: handle seek
                });

                wsRegions.enableDragSelection({
                    color: "rgba(236, 72, 153, 0.2)",
                    drag: true,
                    resize: true,
                });


                wavesurferRef.current = ws;
                regionsRef.current = wsRegions;
                setIsWaveReady(true);
                console.log("[AudioTrimmer] WaveSurfer created, isWaveReady = true");

                // Load audio file immediately if available
                const fileToLoad = audioFile;
                console.log("[AudioTrimmer] fileToLoad:", fileToLoad ? `${fileToLoad instanceof File ? fileToLoad.name : 'Blob'} (${fileToLoad.size} bytes)` : null);
                if (fileToLoad) {
                    // Inline load logic to avoid dependency issues
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                        objectUrlRef.current = null;
                    }
                    const objectUrl = URL.createObjectURL(fileToLoad);
                    objectUrlRef.current = objectUrl;
                    console.log("[AudioTrimmer] Loading audio from URL:", objectUrl);
                    try {
                        isLoadingRef.current = true;
                        ws.load(objectUrl);
                        console.log("[AudioTrimmer] ws.load() called successfully");
                    } catch (loadErr) {
                        isLoadingRef.current = false;
                        console.error("AudioTrimmer: Load error", loadErr);
                        setLoadError("Waveform failed to load. Try reopening the trimmer.");
                    }
                } else {
                    console.log("[AudioTrimmer] No file to load!");
                }
            } catch (err) {
                console.error("AudioTrimmer: Initialization error", err);
                setLoadError("Waveform failed to initialize. Try reopening the trimmer.");
            }
        };

        const waitForLayout = () => {
            if (isDestroyed || hasInitialized) return;
            initWhenReady();
            if (!hasInitialized) {
                initFrames += 1;
                if (initFrames <= 60) {
                    requestAnimationFrame(waitForLayout);
                } else {
                    setLoadError("Waveform container is not ready. Try reopening the trimmer.");
                }
            }
        };

        if (typeof ResizeObserver !== "undefined" && containerEl) {
            resizeObserver = new ResizeObserver(() => {
                initWhenReady();
            });
            resizeObserver.observe(containerEl);
        }

        waitForLayout();

        return () => {
            isDestroyed = true;
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            if (regionsRef.current) {
                try {
                    regionsRef.current.destroy();
                } catch (e) {
                    console.warn("[AudioTrimmer] Plugin destroy error:", e);
                }
                regionsRef.current = null;
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
            if (objectUrlRef.current) {
                const urlToRevoke = objectUrlRef.current;
                objectUrlRef.current = null;
                // Defer revocation if still loading to prevent mid-decode failure
                if (isLoadingRef.current) {
                    setTimeout(() => URL.revokeObjectURL(urlToRevoke), 100);
                } else {
                    URL.revokeObjectURL(urlToRevoke);
                }
            }
            setIsWaveReady(false);
            isLoadingRef.current = false;
        };
    }, [open, containerReady, audioFile, updateRegionState, loadAudioFile, ensureRegionHandles, maxDuration]);

    // ResizeObserver to detect late layout (container gets dimensions after animation)
    React.useEffect(() => {
        if (!open || !containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0 && !containerReady) {
                console.log("[AudioTrimmer] ResizeObserver: Container now has dimensions", { width, height });
                setContainerReady(true);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [open, containerReady]);

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
        let audioContext: AudioContext | null = null;
        try {
            const regions = regionsRef.current?.getRegions() ?? [];
            const activeRegion = regions[0];
            const arrayBuffer = await audioFile.arrayBuffer();
            audioContext = new AudioContext(); // New context for processing
            const waveSurferWithDecode = wavesurferRef.current as unknown as {
                getDecodedData?: () => AudioBuffer | null;
            };
            const decodedFromWaveSurfer =
                typeof waveSurferWithDecode.getDecodedData === "function"
                    ? waveSurferWithDecode.getDecodedData()
                    : null;
            const audioBuffer = decodedFromWaveSurfer ??
                (await audioContext.decodeAudioData(arrayBuffer));

            // Calculate start/end frames
            // Safeguard bounds
            const rawStart = activeRegion?.start ?? regionStart;
            const rawEnd = activeRegion?.end ?? regionEnd;
            let finalStart = Math.max(0, rawStart);
            let finalEnd = Math.min(audioBuffer.duration, rawEnd);

            if (finalEnd <= finalStart) {
                finalStart = 0;
                finalEnd = audioBuffer.duration;
            }

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
        } finally {
            if (audioContext) {
                void audioContext.close();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Trim Audio</DialogTitle>
                    <DialogDescription>
                        Drag on the waveform or the handles to select the part of the audio you want to keep.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div
                        ref={containerCallback}
                        className="w-full h-32 mb-4 rounded-lg overflow-hidden border bg-muted/30"
                    />
                    {loadError && (
                        <div className="text-sm text-destructive mb-2">
                            {loadError}
                        </div>
                    )}

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
