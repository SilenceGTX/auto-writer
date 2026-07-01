"""Tests for the writing word-count helper."""

from app.services.writing_service import count_words


def test_count_words_counts_cjk_individually():
    """Each CJK character counts as one word."""
    assert count_words("今天天气很好") == 6


def test_count_words_ignores_whitespace_and_punctuation():
    """Whitespace and punctuation do not inflate the count (6 CJK chars)."""
    assert count_words("你好，世界！\n再见") == 6


def test_count_words_counts_latin_runs_as_words():
    """Runs of Latin letters / digits each count as a single word (4 CJK + 2)."""
    assert count_words("使用 GPT4 写作 demo") == 6


def test_count_words_empty():
    """Empty or None content yields zero."""
    assert count_words("") == 0
    assert count_words(None) == 0
