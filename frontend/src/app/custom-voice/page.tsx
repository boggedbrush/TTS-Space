"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Mic2, Info, Wand2 } from "lucide-react";
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
import { LANGUAGES, SPEAKERS, MODEL_SIZES, customVoiceSchema } from "@/lib/validators";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RequestQueue } from "@/lib/queue";

const SPEAKER_STYLES: Record<string, { name: string; description: string }[]> = {
    Vivian: [
        { name: "Neutral", description: "" },
        { name: "Happy", description: "用开心愉快的语气说" },
        { name: "Sad", description: "用悲伤失落的语气说" },
        { name: "Angry", description: "用特别愤怒的语气说" },
    ],
    Ryan: [
        { name: "Neutral", description: "" },
        { name: "Excited", description: "Speak with excitement and enthusiasm" },
        { name: "Calm", description: "Speak in a calm, soothing manner" },
        { name: "Professional", description: "Speak professionally and formally" },
    ],
    Serena: [
        { name: "Neutral", description: "" },
        { name: "Friendly", description: "Speak in a warm, friendly tone" },
        { name: "Whisper", description: "Speak softly in a whisper" },
        { name: "Confident", description: "Speak with confidence and authority" },
    ],
};

export default function CustomVoicePage() {
    const compareQueueRef = React.useRef(new RequestQueue(1));
    const [compareMode, setCompareMode] = React.useState(false);
    const [text, setText] = React.useState("");
    const [language, setLanguage] = React.useState("Auto");
    const [speaker, setSpeaker] = React.useState("");
    const [instruct, setInstruct] = React.useState("");
    const [modelSize, setModelSize] = React.useState<"0.6B" | "1.7B">("1.7B");
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
    const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);

    const selectedSpeaker = SPEAKERS.find((s) => s.value === speaker);
    const styles = SPEAKER_STYLES[speaker] || [{ name: "Neutral", description: "" }];

    const handleGenerate = async () => {
        const validation = customVoiceSchema.safeParse({
            text,
            language,
            speaker,
            instruct,
            modelSize,
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
            const result = await apiClient.generateCustomVoice(validation.data);
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

    const handleStyleClick = (style: { name: string; description: string }) => {
        setInstruct(style.description);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                        <Mic2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Custom Voice</h1>
                        <p className="text-sm text-muted-foreground">
                            Use premium pre-trained speakers with style instructions
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left column - Text & Settings */}
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

                    {/* Style instruction */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="instruct">Style Instruction (Optional)</Label>
                        </div>
                        <Textarea
                            id="instruct"
                            placeholder="Add style instructions like 'Speak happily' or 'Use a formal tone'..."
                            value={instruct}
                            onChange={(e) => setInstruct(e.target.value)}
                            showCount
                            maxLength={500}
                            className="min-h-[80px]"
                        />
                        {speaker && styles.length > 1 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {styles.map((style) => (
                                    <button
                                        key={style.name}
                                        onClick={() => handleStyleClick(style)}
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                            instruct === style.description
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                        )}
                                    >
                                        {style.name}
                                    </button>
                                ))}
                            </div>
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

                    {/* Generate button */}
                    <div className="flex gap-3">
                        <Button
                            variant="gradient"
                            size="lg"
                            className="flex-1"
                            onClick={handleGenerate}
                            loading={isGenerating}
                            disabled={!text || !speaker}
                        >
                            {isGenerating ? (
                                "Generating..."
                            ) : (
                                <>
                                    <Wand2 className="h-4 w-4 mr-2" />
                                    Generate Speech
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
                </div>

                {/* Right column - Speakers & Output */}
                <div className="space-y-6">
                    {/* Speaker selection */}
                    <div className="space-y-3">
                        <Label>Select Speaker</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {SPEAKERS.map((s) => (
                                <motion.button
                                    key={s.value}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSpeaker(s.value)}
                                    className={cn(
                                        "relative p-3 rounded-lg border text-center transition-colors overflow-hidden",
                                        speaker === s.value
                                            ? "border-primary bg-primary/10"
                                            : "border-border/50 bg-card/50 hover:border-primary/50"
                                    )}
                                >
                                    {/* Gender indicator */}
                                    <div
                                        className={cn(
                                            "absolute top-1 right-1 w-2 h-2 rounded-full",
                                            s.gender === "female" ? "bg-pink-400" : "bg-blue-400"
                                        )}
                                    />

                                    {/* Avatar placeholder */}
                                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-lg">
                                        {s.gender === "female" ? "👩" : "👨"}
                                    </div>

                                    <div className="font-medium text-sm">{s.label}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {s.language}
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
                                modeOverride="customVoice"
                                hideModeSelect
                                hideSharedFields
                                sharedText={text}
                                sharedLanguage={language}
                                primaryVariant={{
                                    speaker: speaker || undefined,
                                    styleInstruction: instruct || undefined,
                                    modelSize,
                                }}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Label>Generated Audio</Label>
                            <AudioPlayer
                                audioUrl={audioUrl}
                                audioBlob={audioBlob}
                                title="Custom Voice Output"
                            />
                        </div>
                    )}

                    {/* Info box */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Speaker Guide</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Each speaker has a native language for best quality</li>
                                <li>All speakers can speak any supported language</li>
                                <li>Add style instructions for emotional expression</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
