"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Upload, Mic, Info, X, FileAudio, Wand2, Scissors, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AudioPlayer } from "@/components/audio-player";
import { ComparePanel } from "@/components/compare-panel";
import { AudioRecorder } from "@/components/audio-recorder";
import { AudioTrimmer } from "@/components/audio-trimmer";
import { apiClient } from "@/lib/api";
import { LANGUAGES, MODEL_SIZES, voiceCloneSchema } from "@/lib/validators";
import { toast } from "@/hooks/use-toast";
import { cn, formatBytes } from "@/lib/utils";
import { RequestQueue } from "@/lib/queue";

export default function VoiceClonePage() {
    const compareQueueRef = React.useRef(new RequestQueue(1));
    const [compareMode, setCompareMode] = React.useState(false);
    const [text, setText] = React.useState("");
    const [language, setLanguage] = React.useState("Auto");
    const [modelSize, setModelSize] = React.useState<"0.6B" | "1.7B">("1.7B");
    const [refAudio, setRefAudio] = React.useState<File | null>(null);
    const [refText, setRefText] = React.useState("");
    const [xVectorOnly, setXVectorOnly] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
    const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
    const [refAudioUrl, setRefAudioUrl] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [inputMode, setInputMode] = React.useState<"file" | "mic">("file");

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const transcribeRequestIdRef = React.useRef(0);

    const [isTrimming, setIsTrimming] = React.useState(false);
    const [isTranscribing, setIsTranscribing] = React.useState(false);

    // Helper to get audio duration
    const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
            const audio = new Audio(URL.createObjectURL(file));
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
            };
            audio.onerror = () => {
                resolve(0); // Fail safe
            };
        });
    };

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("audio/")) {
            toast({
                title: "Invalid File",
                description: "Please upload an audio file (WAV, MP3, etc.)",
                variant: "destructive",
            });
            return;
        }

        transcribeRequestIdRef.current += 1;
        setRefAudio(file);
        setRefText("");
        const url = URL.createObjectURL(file);
        setRefAudioUrl(url);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleGenerate = async () => {
        const validation = voiceCloneSchema.safeParse({
            text,
            language,
            modelSize,
            refAudio,
            refText,
            xVectorOnly,
        });

        if (!validation.success) {
            toast({
                title: "Validation Error",
                description: validation.error.errors[0].message,
                variant: "destructive",
            });
            return;
        }

        if (!refAudio) {
            toast({
                title: "Missing Reference Audio",
                description: "Please upload a reference audio file",
                variant: "destructive",
            });
            return;
        }

        if (!xVectorOnly && !refText) {
            toast({
                title: "Missing Reference Text",
                description:
                    "Please provide the transcript of the reference audio, or enable X-Vector Only mode",
                variant: "destructive",
            });
            return;
        }

        setIsGenerating(true);
        try {
            const result = await apiClient.generateVoiceClone({
                ...validation.data,
                refAudio,
            });
            const url = URL.createObjectURL(result.audio);
            setAudioUrl(url);
            setAudioBlob(result.audio);
            toast({
                title: "Audio Generated",
                description: `Duration: ${result.duration.toFixed(1)}s`,
                variant: "success",
            });
        } catch (error) {
            toast({
                title: "Generation Failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCancel = () => {
        apiClient.cancel();
        setIsGenerating(false);
    };

    const removeRefAudio = () => {
        transcribeRequestIdRef.current += 1;
        setRefAudio(null);
        if (refAudioUrl) {
            URL.revokeObjectURL(refAudioUrl);
            setRefAudioUrl(null);
        }
    };

    const handleTrimComplete = (trimmedFile: File) => {
        transcribeRequestIdRef.current += 1;
        // Revoke old URL
        if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);

        setRefAudio(trimmedFile);
        setRefText("");
        const url = URL.createObjectURL(trimmedFile);
        setRefAudioUrl(url);

        toast({
            title: "Audio Trimmed",
            description: "Reference audio updated successfully",
            variant: "success",
        });
    };

    const handleAutoTranscribe = React.useCallback(async () => {
        if (!refAudio) {
            toast({
                title: "No Audio",
                description: "Please upload or record reference audio first",
                variant: "destructive",
            });
            return;
        }

        const requestId = transcribeRequestIdRef.current + 1;
        transcribeRequestIdRef.current = requestId;
        setIsTranscribing(true);
        try {
            const transcript = await apiClient.transcribeAudio(refAudio, language);
            if (requestId !== transcribeRequestIdRef.current) return;
            setRefText(transcript);
            toast({
                title: "Transcription Complete",
                description: "Reference text has been automatically filled",
                variant: "success",
            });
        } catch (error) {
            if (requestId !== transcribeRequestIdRef.current) return;
            toast({
                title: "Transcription Failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            if (requestId === transcribeRequestIdRef.current) {
                setIsTranscribing(false);
            }
        }
    }, [refAudio, language]);

    // Auto-transcribe check when audio changes
    React.useEffect(() => {
        const checkAndTranscribe = async () => {
            if (refAudio && !xVectorOnly) {
                // Safety check for empty files
                if (refAudio.size === 0) return;

                // Check duration
                const duration = await getAudioDuration(refAudio);

                // If duration is 0, it likely failed to load metadata or is invalid
                if (duration === 0) {
                    console.log("Audio duration check failed or 0s, skipping auto-transcribe");
                    return;
                }

                if (duration > 30) {
                    toast({
                        title: "Audio Too Long",
                        description: `Reference audio is ${duration.toFixed(1)}s. Please trim to under 30s.`,
                        // Don't error if it's just a restored state, maybe just warn? 
                        // Destructive is fine as it requires user action.
                        variant: "destructive",
                    });
                } else {
                    handleAutoTranscribe();
                }
            }
        };

        checkAndTranscribe();

        // We only want to auto-transcribe when the audio file changes,
        // not when language changes (to preserve manual edits if language is toggled)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refAudio, xVectorOnly]);

    // Clean up URLs on unmount
    React.useEffect(() => {
        return () => {
            if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <AudioTrimmer
                open={isTrimming}
                onOpenChange={setIsTrimming}
                audioFile={refAudio}
                onTrim={handleTrimComplete}
                maxDuration={30}
            />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg">
                        <Mic className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Voice Clone</h1>
                        <p className="text-sm text-muted-foreground">
                            Clone any voice from a short audio sample
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left column - Reference & Settings */}
                <div className="space-y-6">
                    {/* Reference audio input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <Label>Reference Audio</Label>
                            <div className="flex p-1 bg-muted rounded-lg">
                                <button
                                    onClick={() => setInputMode("file")}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        inputMode === "file"
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Upload File
                                </button>
                                <button
                                    onClick={() => setInputMode("mic")}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        inputMode === "mic"
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Record Mic
                                </button>
                            </div>
                        </div>

                        {!refAudio ? (
                            inputMode === "file" ? (
                                <div
                                    className={cn(
                                        "relative rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                                        isDragging
                                            ? "border-primary bg-primary/5"
                                            : "border-border/50 hover:border-primary/50"
                                    )}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="audio/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileSelect(file);
                                        }}
                                    />
                                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                                    <p className="font-medium">Drop audio file here</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        or click to browse (WAV, MP3, etc.)
                                    </p>
                                </div>
                            ) : (
                                <AudioRecorder
                                    onRecordingComplete={handleFileSelect}
                                    onTrim={(file) => {
                                        setRefAudio(file);
                                        const url = URL.createObjectURL(file);
                                        setRefAudioUrl(url);
                                        setIsTrimming(true);
                                    }}
                                />
                            )
                        ) : (
                            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <FileAudio className="h-8 w-8 text-primary" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{refAudio.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatBytes(refAudio.size)}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsTrimming(true)}
                                            title="Trim Audio"
                                        >
                                            <Scissors className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={removeRefAudio}
                                            aria-label="Remove file"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                {refAudioUrl && (
                                    <audio
                                        src={refAudioUrl}
                                        controls
                                        className="w-full h-10 rounded"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                    {/* Reference text */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="refText">Reference Transcript</Label>
                                {!xVectorOnly && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                        onClick={handleAutoTranscribe}
                                        disabled={isTranscribing || !refAudio}
                                        title="Automatically transcribe audio"
                                    >
                                        {isTranscribing ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        ) : (
                                            <Sparkles className="h-3 w-3 mr-1" />
                                        )}
                                        {isTranscribing ? "Transcribing..." : "Auto Transcribe"}
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Label
                                    htmlFor="xVectorOnly"
                                    className="text-xs text-muted-foreground cursor-pointer"
                                >
                                    X-Vector Only Mode
                                </Label>
                                <Switch
                                    id="xVectorOnly"
                                    checked={xVectorOnly}
                                    onCheckedChange={setXVectorOnly}
                                />
                            </div>
                        </div>
                        <Textarea
                            id="refText"
                            placeholder={
                                xVectorOnly
                                    ? "Not required in X-Vector Only mode"
                                    : "Enter the exact transcript of the reference audio..."
                            }
                            value={refText}
                            onChange={(e) => setRefText(e.target.value)}
                            disabled={xVectorOnly}
                            showCount
                            maxLength={1000}
                            className="min-h-[80px]"
                        />
                        {xVectorOnly && (
                            <p className="text-xs text-amber-500">
                                X-Vector Only mode uses only speaker embedding. Quality may be
                                reduced.
                            </p>
                        )}
                    </div>

                    {/* Model size */}
                    <div className="space-y-2">
                        <Label>Model Size</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {MODEL_SIZES.map((size) => (
                                <button
                                    key={size.value}
                                    onClick={() => setModelSize(size.value as "0.6B" | "1.7B")}
                                    className={cn(
                                        "p-3 rounded-lg border text-left transition-colors",
                                        modelSize === size.value
                                            ? "border-primary bg-primary/10"
                                            : "border-border/50 bg-card/50 hover:border-primary/50"
                                    )}
                                >
                                    <div className="font-medium text-sm">{size.label}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {size.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right column - Target text & Output */}
                <div className="space-y-6">
                    {/* Target text */}
                    <div className="space-y-2">
                        <Label htmlFor="text">Target Text</Label>
                        <Textarea
                            id="text"
                            placeholder="Enter the text you want to synthesize in the cloned voice..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            showCount
                            maxLength={5000}
                            className="min-h-[120px]"
                        />
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                        <Label htmlFor="language">Language</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger id="language">
                                <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                                {LANGUAGES.map((lang) => (
                                    <SelectItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Generate button */}
                    <div className="flex gap-3">
                        <Button
                            variant="gradient"
                            size="lg"
                            className="flex-1"
                            onClick={handleGenerate}
                            loading={isGenerating}
                            disabled={!text || !refAudio || (!xVectorOnly && !refText)}
                        >
                            {isGenerating ? (
                                "Cloning..."
                            ) : (
                                <>
                                    <Wand2 className="h-4 w-4 mr-2" />
                                    Clone Voice
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setCompareMode((prev) => !prev)}
                        >
                            {compareMode ? "Single Mode" : "Compare"}
                        </Button>
                        {isGenerating && (
                            <Button variant="outline" size="lg" onClick={handleCancel}>
                                Cancel
                            </Button>
                        )}
                    </div>

                    {/* Output */}
                    {compareMode ? (
                        <div className="space-y-3">
                            <Label>Compare Variants</Label>
                            <ComparePanel
                                queue={compareQueueRef.current}
                                modeOverride="voiceClone"
                                hideModeSelect
                                hideSharedFields
                                sharedText={text}
                                sharedLanguage={language}
                                sharedReferenceText={refText}
                                sharedReferenceFile={refAudio}
                                primaryVariant={{ modelSize, xVectorOnly }}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Label>Generated Audio</Label>
                            <AudioPlayer
                                audioUrl={audioUrl}
                                audioBlob={audioBlob}
                                title="Voice Clone Output"
                            />
                        </div>
                    )}

                    {/* Info box */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Tips for best results</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Use 5-15 seconds of clear reference audio (max 30s)</li>
                                <li>Ensure the transcript exactly matches the audio</li>
                                <li>1.7B model provides higher fidelity cloning</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
