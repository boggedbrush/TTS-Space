const sentenceRegex = /[^.!?。！？]+[.!?。！？]?/g;

export function splitTextSmart(text: string, maxChars = 420) {
    const cleaned = text.trim().replace(/\s+/g, " ");
    if (!cleaned) return [];
    if (cleaned.length <= maxChars) return [cleaned];
    const sentences = cleaned.match(sentenceRegex) || [cleaned];
    const segments: string[] = [];
    let current = "";
    sentences.forEach((sentence) => {
        const candidate = `${current} ${sentence}`.trim();
        if (candidate.length <= maxChars) {
            current = candidate;
        } else {
            if (current) segments.push(current.trim());
            if (sentence.length > maxChars) {
                const chunks = chunkLongSentence(sentence, maxChars);
                chunks.forEach((chunk) => segments.push(chunk));
                current = "";
            } else {
                current = sentence;
            }
        }
    });
    if (current) segments.push(current.trim());
    return segments.filter(Boolean);
}

function chunkLongSentence(sentence: string, maxChars: number) {
    const words = sentence.split(" ");
    const chunks: string[] = [];
    let current = "";
    words.forEach((word) => {
        const candidate = `${current} ${word}`.trim();
        if (candidate.length <= maxChars) {
            current = candidate;
        } else {
            if (current) chunks.push(current);
            current = word;
        }
    });
    if (current) chunks.push(current);
    return chunks;
}
