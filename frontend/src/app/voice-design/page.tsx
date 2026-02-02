"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AudioPlayer } from "@/components/audio-player";
import { ComparePanel } from "@/components/compare-panel";
import { apiClient } from "@/lib/api";
import { LANGUAGES, voiceDesignSchema } from "@/lib/validators";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RequestQueue } from "@/lib/queue";

const VOICE_PRESETS = [
    {
        name: "Cinematic Narrator",
        description:
            "Deep, resonant male voice with gravitas and dramatic pacing. Perfect for trailers and documentaries.",
    },
    {
        name: "Soft Whisper",
        description:
            "Gentle, intimate female voice with breathy quality. Ideal for ASMR or calming content.",
    },
    {
        name: "Energetic Streamer",
        description:
            "Bright, enthusiastic young voice with dynamic range. Great for gaming and entertainment.",
    },
    {
        name: "News Anchor",
        description:
            "Clear, authoritative voice with professional tone. Suitable for informational content.",
    },
    {
        name: "Friendly Assistant",
        description:
            "Warm, approachable voice with natural conversational flow. Perfect for AI assistants.",
    },
    {
        name: "Storyteller",
        description:
            "Expressive voice with varied intonation for character voices. Ideal for audiobooks.",
    },
];

export default function VoiceDesignPage() {
    const compareQueueRef = React.useRef(new RequestQueue(1));
    const [compareMode, setCompareMode] = React.useState(false);
    const [text, setText] = React.useState("");
    const [language, setLanguage] = React.useState("Auto");
    const [voiceDescription, setVoiceDescription] = React.useState("");
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
    const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);

    const handleGenerate = async () => {
        const validation = voiceDesignSchema.safeParse({
            text,
            language,
            voiceDescription,
        });

        if (!validation.success) {
            toast({
                title: "Validation Error",
                description: validation.error.errors[0].message,
                variant: "destructive",
            });
            return;
        }

        setIsGenerating(true);
        try {
            const result = await apiClient.generateVoiceDesign(validation.data);
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

    const handlePresetClick = (preset: (typeof VOICE_PRESETS)[0]) => {
        setVoiceDescription(preset.description);
    };

    const handleCancel = () => {
        apiClient.cancel();
        setIsGenerating(false);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Voice Design</h1>
                        <p className="text-sm text-muted-foreground">
                            Create new voices from natural language descriptions
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left column - Inputs */}
                <div className="space-y-6">
                    {/* Text input */}
                    <div className="space-y-2">
                        <Label htmlFor="text">Text to Synthesize</Label>
                        <Textarea
                            id="text"
                            placeholder="Enter the text you want to convert to speech..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            showCount
                            maxLength={5000}
                            className="min-h-[120px]"
                        />
                    </div>

                    {/* Language selector */}
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

                    {/* Voice description */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="voiceDescription">Voice Description</Label>
                            <span className="text-xs text-muted-foreground">
                                Describe the voice you want to create
                            </span>
                        </div>
                        <Textarea
                            id="voiceDescription"
                            placeholder="Describe the voice characteristics: gender, age, tone, emotion, accent, speaking style..."
                            value={voiceDescription}
                            onChange={(e) => setVoiceDescription(e.target.value)}
                            showCount
                            maxLength={1000}
                            className="min-h-[100px]"
                        />
                    </div>

                    {/* Generate button */}
                    <div className="flex gap-3">
                        <Button
                            variant="gradient"
                            size="lg"
                            className="flex-1"
                            onClick={handleGenerate}
                            loading={isGenerating}
                            disabled={!text || !voiceDescription}
                        >
                            {isGenerating ? (
                                "Generating..."
                            ) : (
                                <>
                                    <Wand2 className="h-4 w-4 mr-2" />
                                    Generate Voice
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

                    {/* Info box */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">
                                Voice Design uses the 1.7B model
                            </p>
                            <p>
                                This mode creates entirely new voices from descriptions. For best
                                results, be specific about gender, age, tone, emotion, and speaking
                                style.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right column - Presets & Player */}
                <div className="space-y-6">
                    {/* Presets */}
                    <div className="space-y-3">
                        <Label>Voice Presets</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {VOICE_PRESETS.map((preset) => (
                                <motion.button
                                    key={preset.name}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handlePresetClick(preset)}
                                    className={cn(
                                        "p-3 rounded-lg border text-left transition-colors",
                                        voiceDescription === preset.description
                                            ? "border-primary bg-primary/10"
                                            : "border-border/50 bg-card/50 hover:border-primary/50"
                                    )}
                                >
                                    <div className="font-medium text-sm">{preset.name}</div>
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {preset.description}
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Output */}
                    {compareMode ? (
                        <div className="space-y-3">
                            <Label>Compare Variants</Label>
                            <ComparePanel
                                queue={compareQueueRef.current}
                                modeOverride="voiceDesign"
                                hideModeSelect
                                hideSharedFields
                                sharedText={text}
                                sharedLanguage={language}
                                primaryVariant={{ voiceDescription }}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Label>Generated Audio</Label>
                            <AudioPlayer
                                audioUrl={audioUrl}
                                audioBlob={audioBlob}
                                title="Voice Design Output"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
