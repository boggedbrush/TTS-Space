def split_text(text: str, max_chars: int) -> list[str]:
    cleaned = " ".join(text.strip().split())
    if not cleaned:
        return []
    if len(cleaned) <= max_chars:
        return [cleaned]
    segments: list[str] = []
    current = ""
    for chunk in cleaned.replace("!", "!. ").replace("?", "?. ").split(". "):
        candidate = f"{current} {chunk}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                segments.append(current)
            if len(chunk) > max_chars:
                words = chunk.split(" ")
                temp = ""
                for word in words:
                    candidate = f"{temp} {word}".strip()
                    if len(candidate) <= max_chars:
                        temp = candidate
                    else:
                        if temp:
                            segments.append(temp)
                        temp = word
                if temp:
                    segments.append(temp)
                current = ""
            else:
                current = chunk
    if current:
        segments.append(current)
    return [segment.strip() for segment in segments if segment.strip()]
