import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { HeaderClient } from "@/components/header-client";
import { StatusBarWrapper } from "@/components/status-bar-wrapper";
import { GenerationGuardProvider } from "@/components/generation-guard";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "TTS Studio | Premium Text-to-Speech",
    description:
        "State-of-the-art AI voice synthesis with Voice Design, Voice Cloning, and Custom Voices. Generate natural, expressive speech in 10+ languages.",
    keywords: [
        "TTS",
        "text to speech",
        "voice synthesis",
        "voice cloning",
        "AI voice",
        "TTS Studio",
    ],
    authors: [{ name: "Qwen Team" }],
    openGraph: {
        title: "TTS Studio",
        description: "Premium AI Text-to-Speech with Voice Design and Cloning",
        type: "website",
    },
    icons: {
        icon: "/favicon.svg",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning data-darkreader-ignore>
            <head>
                <meta name="darkreader-lock" />
            </head>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
                suppressHydrationWarning
                data-darkreader-ignore
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <GenerationGuardProvider>
                        <div className="relative min-h-screen bg-background">
                            {/* Gradient background effect */}
                            <div className="fixed inset-0 -z-10 overflow-hidden">
                                <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-primary/5 blur-3xl" />
                                <div className="absolute -bottom-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-accent/5 blur-3xl" />
                            </div>

                            <HeaderClient />
                            <main className="container mx-auto px-4 py-8">{children}</main>
                        </div>
                        <StatusBarWrapper />
                        <Toaster />
                    </GenerationGuardProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
