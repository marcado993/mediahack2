"""
Turns scraped post captions into a simple keyword/topic frequency table -
the "de qué se habla" layer. Deliberately lightweight (no spaCy/NLTK model
download) so it runs anywhere instantly; swap in a real NLP pipeline later
if the word-frequency approach turns out too crude.

Usage:
    python topics.py            # reads output/posts.json, writes output/topics.json
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

POSTS_PATH = Path(__file__).parent / "output" / "posts.json"
TOPICS_PATH = Path(__file__).parent / "output" / "topics.json"

# Minimal Spanish stopword list - extend as needed.
STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
    "y", "o", "u", "e", "que", "en", "a", "por", "para", "con", "sin", "se",
    "su", "sus", "es", "son", "fue", "ser", "esta", "este", "esa", "ese",
    "lo", "le", "les", "más", "muy", "ya", "no", "sí", "como", "pero", "si",
    "hoy", "ayer", "también", "sobre", "entre", "hasta", "desde", "nos",
}

WORD_RE = re.compile(r"[a-záéíóúñü]+", re.IGNORECASE)


def extract_words(text: str) -> list[str]:
    if not text:
        return []
    return [w.lower() for w in WORD_RE.findall(text) if len(w) > 3 and w.lower() not in STOPWORDS]


def main() -> None:
    if not POSTS_PATH.exists():
        raise SystemExit(f"{POSTS_PATH} not found - run instagram_scraper.py first.")

    data = json.loads(POSTS_PATH.read_text(encoding="utf-8"))
    word_counts: Counter = Counter()
    hashtag_counts: Counter = Counter()
    per_account: dict[str, Counter] = {}

    for post in data["posts"]:
        words = extract_words(post.get("caption", ""))
        word_counts.update(words)
        hashtag_counts.update(h.lower() for h in post.get("hashtags", []))
        acct = post["account"]
        per_account.setdefault(acct, Counter()).update(words)

    result = {
        "generated_from": str(POSTS_PATH),
        "post_count": len(data["posts"]),
        "top_words": word_counts.most_common(30),
        "top_hashtags": hashtag_counts.most_common(30),
        "top_words_by_account": {acct: c.most_common(10) for acct, c in per_account.items()},
    }

    TOPICS_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote topic summary to {TOPICS_PATH}")


if __name__ == "__main__":
    main()
