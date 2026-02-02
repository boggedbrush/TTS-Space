"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

type GenerationGuardContextValue = {
    setGenerating: (id: string, generating: boolean) => void;
};

const GenerationGuardContext = React.createContext<GenerationGuardContextValue | null>(null);

const WARNING_MESSAGE =
    "Audio is currently being generated. Are you sure you want to leave this page?";

export function GenerationGuardProvider({ children }: { children: React.ReactNode }) {
    const generatorsRef = React.useRef<Map<string, boolean>>(new Map());
    const [isBlocking, setIsBlocking] = React.useState(false);
    const isBlockingRef = React.useRef(isBlocking);
    const lastUrlRef = React.useRef<string | null>(null);
    const pathname = usePathname();

    const setGenerating = React.useCallback((id: string, generating: boolean) => {
        if (generating) {
            generatorsRef.current.set(id, true);
        } else {
            generatorsRef.current.delete(id);
        }

        const nextBlocking = Array.from(generatorsRef.current.values()).some(Boolean);
        setIsBlocking(nextBlocking);
    }, []);

    React.useEffect(() => {
        isBlockingRef.current = isBlocking;
    }, [isBlocking]);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        lastUrlRef.current = window.location.href;
    }, [pathname]);

    React.useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!isBlockingRef.current) return;
            event.preventDefault();
            event.returnValue = WARNING_MESSAGE;
        };

        const handlePopState = () => {
            if (!isBlockingRef.current) {
                lastUrlRef.current = window.location.href;
                return;
            }

            const confirmed = window.confirm(WARNING_MESSAGE);
            if (!confirmed && lastUrlRef.current) {
                history.pushState(null, "", lastUrlRef.current);
            }
        };

        const handleClickCapture = (event: MouseEvent) => {
            if (!isBlockingRef.current) return;
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

            const target = event.target as Element | null;
            if (!target) return;

            const anchor = target.closest("a");
            if (!anchor) return;

            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
            if (anchor.getAttribute("target") === "_blank") return;

            const confirmed = window.confirm(WARNING_MESSAGE);
            if (!confirmed) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        document.addEventListener("click", handleClickCapture, true);
        window.addEventListener("popstate", handlePopState);
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            document.removeEventListener("click", handleClickCapture, true);
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    return (
        <GenerationGuardContext.Provider value={{ setGenerating }}>
            {children}
        </GenerationGuardContext.Provider>
    );
}

export function useGenerationGuard(isGenerating: boolean) {
    const context = React.useContext(GenerationGuardContext);
    const id = React.useId();

    React.useEffect(() => {
        if (!context) return;
        context.setGenerating(id, isGenerating);
        return () => {
            context.setGenerating(id, false);
        };
    }, [context, id, isGenerating]);
}
