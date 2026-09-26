"""
Lightweight sentiment and urgency detection.

Runs locally with no external calls, so it adds no latency and sends no
customer text anywhere. Supports English and common Arabic phrases.
"""

import re


ANGRY_WORDS = [
    "unacceptable", "ridiculous", "furious", "scam", "fraud", "worst",
    "terrible", "horrible", "disgusting", "lawyer", "sue", "never again",
    "angry", "useless", "joke", "stolen",
    "غاضب", "احتيال", "نصب", "سيء جدا", "اسوأ", "مهزلة", "محامي",
]

NEGATIVE_WORDS = [
    "not happy", "disappointed", "problem", "issue", "broken", "damaged",
    "late", "delay", "missing", "wrong", "charged twice",
    "complaint", "bad", "poor", "still waiting", "didn't arrive",
    "not received", "frustrated", "upset",
    "مشكلة", "متأخر", "تأخير", "مكسور", "تالف", "لم يصل", "استرجاع",
    "شكوى", "خطأ", "زعلان",
]

POSITIVE_WORDS = [
    "thank", "thanks", "great", "perfect", "awesome", "love", "excellent",
    "appreciate", "helpful", "amazing",
    "شكرا", "ممتاز", "رائع", "جميل", "مشكور",
]


def _count(text, words):
    count = 0

    for word in words:
        if word.isascii():
            # Whole words only, so "sue" does not match "issue"
            if re.search(r"\b" + re.escape(word) + r"\b", text):
                count += 1
        elif word in text:
            count += 1

    return count


def analyze_sentiment(text):
    """Return one of: positive, neutral, negative, angry."""

    if not text:
        return "neutral"

    lowered = text.lower()

    angry = _count(lowered, ANGRY_WORDS)
    negative = _count(lowered, NEGATIVE_WORDS)
    positive = _count(lowered, POSITIVE_WORDS)

    letters = re.findall(r"[A-Za-z]", text)
    shouting = (
        len(letters) > 12
        and sum(1 for c in letters if c.isupper()) / len(letters) > 0.6
    )

    exclamations = text.count("!") >= 3

    if angry or (negative and (shouting or exclamations)):
        return "angry"

    if negative > positive:
        return "negative"

    if positive > negative:
        return "positive"

    return "neutral"
