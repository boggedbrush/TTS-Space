"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Info,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Loader2,
    X,
    Wifi,
    WifiOff,
} from "lucide-react";
import { useStatus, StatusMessage } from "@/hooks/use-status";
import { cn } from "@/lib/utils";

const statusConfig = {
    info: {
        icon: Info,
        bgClass: "bg-blue-500/10 border-blue-500/30",
        iconClass: "text-blue-500",
    },
    warning: {
        icon: AlertTriangle,
        bgClass: "bg-amber-500/10 border-amber-500/30",
        iconClass: "text-amber-500",
    },
    error: {
        icon: AlertCircle,
        bgClass: "bg-red-500/10 border-red-500/30",
        iconClass: "text-red-500",
    },
    progress: {
        icon: Loader2,
        bgClass: "bg-primary/10 border-primary/30",
        iconClass: "text-primary",
    },
    success: {
        icon: CheckCircle2,
        bgClass: "bg-emerald-500/10 border-emerald-500/30",
        iconClass: "text-emerald-500",
    },
};

export function StatusBar() {
    const { status, isConnected, dismiss } = useStatus({
        autoDismissMs: 8000, // Auto-dismiss after 8 seconds (except progress)
    });

    const config = status ? statusConfig[status.type] : null;
    const Icon = config?.icon;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
            {/* Connection indicator (shows briefly when disconnected) */}
            <AnimatePresence>
                {!isConnected && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground"
                    >
                        <WifiOff className="h-3 w-3" />
                        <span>Reconnecting...</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status message */}
            <AnimatePresence mode="wait">
                {status && config && Icon && (
                    <motion.div
                        key={status.timestamp}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg max-w-md",
                            config.bgClass
                        )}
                    >
                        <Icon
                            className={cn(
                                "h-5 w-5 flex-shrink-0",
                                config.iconClass,
                                status.type === "progress" && "animate-spin"
                            )}
                        />

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {status.message}
                            </p>
                            {status.progress !== undefined && (
                                <div className="mt-1.5 h-1.5 w-full bg-background/50 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${status.progress}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            )}
                        </div>

                        {status.type !== "progress" && (
                            <button
                                onClick={dismiss}
                                className="p-1 rounded-md hover:bg-background/30 transition-colors flex-shrink-0"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
