import { Preset } from "@/lib/types";

export const LANGUAGES = [
    "Auto",
    "Chinese",
    "English",
    "Japanese",
    "Korean",
    "French",
    "German",
    "Spanish",
    "Portuguese",
    "Russian",
];

export const SPEAKERS = [
    "Aiden",
    "Dylan",
    "Eric",
    "Ono_anna",
    "Ryan",
    "Serena",
    "Sohee",
    "Uncle_fu",
    "Vivian",
];

export const MODEL_SIZES = ["0.6B", "1.7B"] as const;

export const MODEL_IDS = {
    voiceDesign: "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    base: {
        "0.6B": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        "1.7B": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    },
    custom: {
        "0.6B": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        "1.7B": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    },
};

export const VOICE_DESIGN_PRESETS: Preset[] = [
    {
        id: "cinematic",
        title: "Cinematic Narrator",
        description: "Wide, expansive tone with controlled gravitas and crisp diction.",
        value:
            "A cinematic narrator with a calm, resonant baritone. Slow pace, articulate phrasing, and a sense of scale.",
    },
    {
        id: "whisper",
        title: "Soft Whisper",
        description: "Breathy, intimate whisper with gentle pacing and close-mic warmth.",
        value:
            "A soft whisper, close microphone presence, warm breathy texture, gentle pacing, and intimate tone.",
    },
    {
        id: "streamer",
        title: "Energetic Streamer",
        description: "Bright, upbeat delivery with playful emphasis and short pauses.",
        value:
            "An energetic streamer voice, lively and upbeat with playful emphasis, quick pacing, and clear articulation.",
    },
    {
        id: "documentary",
        title: "Documentary Host",
        description: "Neutral, confident delivery for factual clarity.",
        value:
            "A documentary host voice, neutral but confident, medium pace, precise articulation, authoritative yet friendly.",
    },
    {
        id: "poetic",
        title: "Poetic Storyteller",
        description: "Expressive, musical phrasing with tender pauses.",
        value:
            "A poetic storyteller with gentle dynamics, musical phrasing, and tender pauses.",
    },
];

export const CUSTOM_VOICE_PRESETS: Record<string, Preset[]> = {
    Aiden: [
        {
            id: "aiden-bright",
            title: "Bright Mentor",
            description: "Optimistic, encouraging cadence with crisp consonants.",
            value: "Bright and encouraging mentor voice, clear consonants and upbeat pacing.",
        },
        {
            id: "aiden-calm",
            title: "Calm Guide",
            description: "Even pace, low variance for instructional content.",
            value: "Calm instructional tone, steady pace, minimal pitch variance.",
        },
    ],
    Dylan: [
        {
            id: "dylan-night",
            title: "Late Night Radio",
            description: "Smooth and cozy with relaxed pacing.",
            value: "Smooth late-night radio host, relaxed pacing with velvety warmth.",
        },
        {
            id: "dylan-energized",
            title: "Energized",
            description: "Punchier rhythm, crisp articulation.",
            value: "Energized delivery, punchy rhythm, crisp articulation.",
        },
    ],
    Eric: [
        {
            id: "eric-analyst",
            title: "Analyst",
            description: "Focused, structured, concise.",
            value: "Focused analyst tone, structured phrasing, concise emphasis.",
        },
    ],
    Ono_anna: [
        {
            id: "ono-anna-serene",
            title: "Serene",
            description: "Soft, delicate delivery with warmth.",
            value: "Serene and delicate, soft warmth, gentle pacing.",
        },
        {
            id: "ono-anna-playful",
            title: "Playful",
            description: "Light, expressive, a touch of whimsy.",
            value: "Playful and expressive, light tone with a touch of whimsy.",
        },
    ],
    Ryan: [
        {
            id: "ryan-anchor",
            title: "News Anchor",
            description: "Confident, steady, broadcast-ready.",
            value: "Confident news anchor, steady delivery, broadcast-ready clarity.",
        },
    ],
    Serena: [
        {
            id: "serena-warm",
            title: "Warm Welcome",
            description: "Inviting, friendly pacing.",
            value: "Warm welcoming voice, friendly pacing, clear articulation.",
        },
    ],
    Sohee: [
        {
            id: "sohee-luxe",
            title: "Luxe",
            description: "Refined, gentle luxury tone.",
            value: "Refined luxe tone, gentle delivery with soft elegance.",
        },
    ],
    Uncle_fu: [
        {
            id: "uncle-fu-story",
            title: "Story Time",
            description: "Warm, familial storytelling.",
            value: "Warm familial storytelling voice, medium pace, relaxed tone.",
        },
    ],
    Vivian: [
        {
            id: "vivian-pop",
            title: "Pop Host",
            description: "Bright, confident, modern.",
            value: "Bright pop host voice, confident delivery, modern energy.",
        },
    ],
};

export const CLONE_GUIDANCE: Preset[] = [
    {
        id: "clone-clean",
        title: "Clean Studio",
        description: "Use 10-20s of clean, close-mic audio. Avoid music or reverb.",
        value: "Record in a quiet room, 10-20 seconds, close microphone, no background noise.",
    },
    {
        id: "clone-natural",
        title: "Natural Conversation",
        description: "Natural conversational tone with a consistent cadence.",
        value: "Provide a natural conversational sample with consistent cadence and minimal pauses.",
    },
    {
        id: "clone-dynamic",
        title: "Dynamic Range",
        description: "Include emotional range but avoid clipping.",
        value: "Include slight emotional variation while avoiding clipping or loud background sounds.",
    },
];

export const QUALITY_TIPS: Record<string, string[]> = {
    Auto: [
        "Auto detects language but works best with clear punctuation.",
        "Avoid mixing languages in a single sentence for best consistency.",
    ],
    English: [
        "Use punctuation to guide phrasing and pauses.",
        "For emphatic words, use commas or em dashes for clarity.",
    ],
    Chinese: [
        "Shorter sentences improve rhythm in Mandarin.",
        "Use full-width punctuation to help phrasing.",
    ],
    Japanese: [
        "Add punctuation like '、' and '。' for natural phrasing.",
        "Avoid long run-on sentences to reduce monotone output.",
    ],
    Korean: [
        "Use spacing and punctuation to guide emphasis.",
        "Keep sentences under 30 characters for clarity.",
    ],
    French: [
        "Use commas to separate clauses for smooth phrasing.",
        "Avoid mixing English proper nouns unless necessary.",
    ],
    German: [
        "Compound nouns benefit from commas for readability.",
        "Use shorter sentences to avoid robotic cadence.",
    ],
    Spanish: [
        "Include punctuation for questions and exclamations.",
        "Break long sentences to keep the rhythm natural.",
    ],
    Portuguese: [
        "Include accents in text for correct pronunciation.",
        "Use commas to separate clauses for clean pacing.",
    ],
    Russian: [
        "Use punctuation to avoid run-on monotone delivery.",
        "Avoid uncommon abbreviations for clarity.",
    ],
};

export const SPEAKER_TIPS: Record<string, string[]> = {
    Aiden: ["Aiden excels at instructional and mentorship tones.", "Pair with shorter sentences for clarity."],
    Dylan: ["Dylan suits conversational or late-night formats.", "Use commas to keep rhythm smooth."],
    Eric: ["Eric performs best with structured, analytical scripts.", "Avoid heavy slang for clean delivery."],
    Ono_anna: ["Ono_anna shines in gentle, expressive reads.", "Add pauses for natural warmth."],
    Ryan: ["Ryan is ideal for announcements and news cadence.", "Use crisp punctuation."],
    Serena: ["Serena works well for friendly onboarding flows.", "Short sentences keep delivery bright."],
    Sohee: ["Sohee complements premium product narration.", "Style prompts should be concise."],
    Uncle_fu: ["Uncle_fu fits story-time or warm guiding tones.", "Include light emotion cues."],
    Vivian: ["Vivian pairs well with energetic or pop content.", "Use exclamation sparingly for emphasis."],
};
