"use client";

import * as React from "react";
import { Mic, Square, Play, RotateCcw, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
    onRecordingComplete: (file: File) => void;
    onCancel?: () => void;
    className?: string;
}

export function AudioRecorder({
    onRecordingComplete,
    onCancel,
    className,
}: AudioRecorderProps) {
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const chunksRef = React.useRef<Blob[]>([]);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            stopTracks();
        };
    }, []);

    const stopTracks = () => {
        if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/wav" });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                stopTracks();
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            // Handle error (could prop callbacks for toast)
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const resetRecording = () => {
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setRecordingTime(0);
    };

    const handleConfirm = () => {
        if (audioBlob) {
            const file = new File([audioBlob], "recorded-audio.wav", {
                type: "audio/wav",
            });
            onRecordingComplete(file);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (audioBlob) {
        return (
            <div className={cn("p-4 border rounded-xl bg-card/50", className)}>
                <div className="flex items-center justify-between mb-4">
                    <span className="font-medium">Recording Preview</span>
                    <span className="text-sm text-muted-foreground">
                        {formatTime(recordingTime)}
                    </span>
                </div>

                {audioUrl && (
                    <audio src={audioUrl} controls className="w-full mb-4 h-10" />
                )}

                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetRecording}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Discard
                    </Button>
                    <div className="flex-1" />
                    <Button size="sm" onClick={handleConfirm} className="gap-2">
                        <Check className="h-4 w-4" />
                        Use Recording
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("p-8 border-2 border-dashed rounded-xl text-center space-y-4", className)}>
            <div className="flex justify-center">
                <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className={cn(
                        "h-16 w-16 rounded-full transition-all duration-300",
                        isRecording ? "animate-pulse" : "hover:scale-110"
                    )}
                    onClick={isRecording ? stopRecording : startRecording}
                >
                    {isRecording ? (
                        <Square className="h-6 w-6 fill-current" />
                    ) : (
                        <Mic className="h-6 w-6" />
                    )}
                </Button>
            </div>

            <div className="space-y-1">
                <p className="font-medium">
                    {isRecording ? "Recording..." : "Click to Record"}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                    {formatTime(recordingTime)}
                </p>
            </div>

            {isRecording && (
                <p className="text-xs text-muted-foreground animate-pulse">
                    Speak clearly into your microphone
                </p>
            )}
        </div>
    );
}
