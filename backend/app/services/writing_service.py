"""Writing-page helpers: chapter word counting.

Holds the pure, testable pieces used by the writing router. Word counting treats
each CJK character as one word and each run of Latin letters / digits as one
word, which matches how Chinese novel "字数" is usually reported while still
handling embedded English terms reasonably.
"""

import re

_CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0002ffff]")
_LATIN = re.compile(r"[A-Za-z0-9]+")


def count_words(text: str | None) -> int:
    """Count a chapter's words: CJK chars individually + Latin/number runs."""
    if not text:
        return 0
    return len(_CJK.findall(text)) + len(_LATIN.findall(text))
