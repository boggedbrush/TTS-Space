"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface StatusMessage {
    message: string;
    type: "info" | "warning" | "error" | "progress" | "success";
    timestamp: number;
    progress?: number;
}

interface UseStatusOptions {
    /** Auto-dismiss timeout in ms (0 to disable) */
    autoDismissMs?: number;
    /** Reconnect delay in ms */
    reconnectDelayMs?: number;
}

// Use the current hostname so clients on LAN can access the backend
// Use the current hostname so clients on LAN can access the backend
const getApiBase = () => {
    if (typeof window === "undefined") return "";

    // Use explicit API URL if configured (for tunnels/remote)
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
    }

    // Use relative path if proxying through same origin or in Docker
    if (window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1") {
        return "/api";
    }

    // Development mode fallback
    return `http://${window.location.hostname}:8000/api`;
};

export function useStatus(options: UseStatusOptions = {}) {
    const { autoDismissMs = 5000, reconnectDelayMs = 3000 } = options;

    const [status, setStatus] = useState<StatusMessage | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearDismissTimeout = useCallback(() => {
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
    }, []);

    const scheduleDismiss = useCallback(() => {
        clearDismissTimeout();
        if (autoDismissMs > 0 && status?.type !== "progress") {
            dismissTimeoutRef.current = setTimeout(() => {
                setStatus(null);
            }, autoDismissMs);
        }
    }, [autoDismissMs, clearDismissTimeout, status?.type]);

    const connect = useCallback(() => {
        // Clean up existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const apiBase = getApiBase();
        if (!apiBase) return;

        const eventSource = new EventSource(`${apiBase}/status/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
            // Clear any pending reconnect
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as StatusMessage;
                setStatus(data);
            } catch {
                // Ignore parse errors (e.g., ping messages)
            }
        };

        eventSource.onerror = () => {
            setIsConnected(false);
            eventSource.close();
            eventSourceRef.current = null;

            // Schedule reconnect
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, reconnectDelayMs);
        };
    }, [reconnectDelayMs]);

    const dismiss = useCallback(() => {
        clearDismissTimeout();
        setStatus(null);
    }, [clearDismissTimeout]);

    // Connect on mount
    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            clearDismissTimeout();
        };
    }, [connect, clearDismissTimeout]);

    // Schedule auto-dismiss when status changes
    useEffect(() => {
        if (status && status.type !== "progress") {
            scheduleDismiss();
        }
        return clearDismissTimeout;
    }, [status, scheduleDismiss, clearDismissTimeout]);

    return {
        status,
        isConnected,
        dismiss,
        reconnect: connect,
    };
}
