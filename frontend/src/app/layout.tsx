import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/header";
import { StatusBarWrapper } from "@/components/status-bar-wrapper";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

export const metadata: Metadata = {
    title: "Qwen3-TTS Studio | Premium Text-to-Speech",
    description:
        "State-of-the-art AI voice synthesis with Voice Design, Voice Cloning, and Custom Voices. Generate natural, expressive speech in 10+ languages.",
    keywords: [
        "TTS",
        "text to speech",
        "voice synthesis",
        "voice cloning",
        "AI voice",
        "Qwen3",
    ],
    authors: [{ name: "Qwen Team" }],
    openGraph: {
        title: "Qwen3-TTS Studio",
        description: "Premium AI Text-to-Speech with Voice Design and Cloning",
        type: "website",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <div className="relative min-h-screen bg-background">
                        {/* Gradient background effect */}
                        <div className="fixed inset-0 -z-10 overflow-hidden">
                            <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-primary/5 blur-3xl" />
                            <div className="absolute -bottom-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-accent/5 blur-3xl" />
                        </div>

                        <Header />
                        <main className="container mx-auto px-4 py-8">{children}</main>
                    </div>
                    <StatusBarWrapper />
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
