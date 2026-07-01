"""Tests for the `@` reference parsing and prompt-block assembly helpers."""

from app.services.references import (
    ReferencedEntry,
    build_reference_block,
    find_referenced_names,
)


def test_find_referenced_names_basic():
    """Names referenced via `@` are detected; unreferenced ones are excluded."""
    names = find_referenced_names(
        ["主角 @张三 来到 @黑暗森林 探险"], ["张三", "黑暗森林", "李四"]
    )
    assert names == ["张三", "黑暗森林"]


def test_find_referenced_names_prefers_longest_match():
    """A longer name is preferred over a shorter prefix name at the same `@`."""
    names = find_referenced_names(["这是 @张三丰 的剑法"], ["张三", "张三丰"])
    assert names == ["张三丰"]


def test_find_referenced_names_scans_multiple_texts():
    """References are collected across all supplied texts."""
    names = find_referenced_names(["提到 @魔法石", "以及 @古城"], ["魔法石", "古城"])
    assert set(names) == {"魔法石", "古城"}


def test_build_reference_block_renders_fields():
    """The reference block renders category, description, and properties."""
    block = build_reference_block(
        [
            ReferencedEntry(
                name="张三",
                category="人物",
                description="主角",
                properties=[{"name": "年龄", "value": "24"}, {"name": "身份", "value": "骑士"}],
            )
        ]
    )
    assert "【引用设定】" in block
    assert "张三（人物）：主角" in block
    assert "年龄=24" in block
    assert "身份=骑士" in block


def test_build_reference_block_empty_is_blank():
    """An empty entry list produces an empty block (no injection)."""
    assert build_reference_block([]) == ""
