"""Display-layer i18n for preset story structures (DB keeps Chinese stable keys).

Mirrors ``frontend/src/utils/storyStructureI18n.ts`` and ``seed.py`` presets.
"""

from app.deps.locale import PromptLocale

STRUCTURE_KEYS: dict[str, str] = {
    "无": "none",
    "三幕式": "three_act",
    "起承转合": "kishotenketsu",
    "英雄之旅": "hero_journey",
    "斯奈德节拍表": "save_the_cat",
}

PRESET_ZH_STAGES: dict[str, list[str]] = {
    "none": [],
    "three_act": ["铺垫", "对抗", "解决"],
    "kishotenketsu": ["开端", "发展", "转折", "结尾"],
    "hero_journey": [
        "平凡世界",
        "冒险的召唤",
        "拒绝召唤",
        "遇见导师",
        "跨越第一道门槛",
        "考验、盟友与敌人",
        "接近深洞穴",
        "严峻考验",
        "获得奖赏",
        "返回之路",
        "复活与蜕变",
        "带着灵药归来",
    ],
    "save_the_cat": [
        "开场画面",
        "主题陈述",
        "建立",
        "催化剂",
        "内心挣扎",
        "进入第二幕",
        "B 故事",
        "趣味与游戏",
        "中点",
        "坏蛋逼近",
        "一败涂地",
        "灵魂的黑夜",
        "进入第三幕",
        "结局",
        "终场画面",
    ],
}

PRESET_EN: dict[str, dict[str, object]] = {
    "none": {
        "name": "None",
        "stages": [],
        "description": "Freeform writing with no fixed structural constraints.",
    },
    "three_act": {
        "name": "Three-act structure",
        "stages": ["Setup", "Confrontation", "Resolution"],
        "description": "The most common story skeleton—clear, reliable, and beginner-friendly.",
    },
    "kishotenketsu": {
        "name": "Kishōtenketsu",
        "stages": ["Introduction", "Development", "Twist", "Conclusion"],
        "description": (
            "Classic East Asian narrative rhythm that favors atmosphere and implication."
        ),
    },
    "hero_journey": {
        "name": "The Hero's Journey",
        "stages": [
            "Ordinary World",
            "Call to Adventure",
            "Refusal of the Call",
            "Meeting with the Mentor",
            "Crossing the First Threshold",
            "Tests, Allies, and Enemies",
            "Approach to the Inmost Cave",
            "The Ordeal",
            "Reward",
            "The Road Back",
            "The Resurrection",
            "Return with the Elixir",
        ],
        "description": (
            "The standard “ordinary person becomes a hero” template—"
            "well suited to fantasy, science fiction, and coming-of-age adventures."
        ),
    },
    "save_the_cat": {
        "name": "Save the Cat! Beat Sheet",
        "stages": [
            "Opening Image",
            "Theme Stated",
            "Set-Up",
            "Catalyst",
            "Debate",
            "Break into Two",
            "B Story",
            "Fun and Games",
            "Midpoint",
            "Bad Guys Close In",
            "All Is Lost",
            "Dark Night of the Soul",
            "Break into Three",
            "Finale",
            "Final Image",
        ],
        "description": (
            "A tightly paced commercial beat sheet—ideal for fast-moving, plot-driven stories."
        ),
    },
}


def is_preset_structure_name(name: str) -> bool:
    """Return whether *name* is a seeded preset structure label."""
    return name in STRUCTURE_KEYS


def translate_preset_structure_name(name: str, locale: PromptLocale) -> str:
    """Translate a preset structure name for prompts; custom names pass through."""
    if locale == "zh":
        return name
    key = STRUCTURE_KEYS.get(name)
    if not key:
        return name
    return str(PRESET_EN[key]["name"])


def translate_preset_structure_description(
    structure_name: str, description: str | None, locale: PromptLocale
) -> str | None:
    """Translate a preset structure description for prompts."""
    if locale == "zh":
        return description
    key = STRUCTURE_KEYS.get(structure_name)
    if not key:
        return description
    return str(PRESET_EN[key].get("description", description or ""))


def translate_preset_stage_name(
    structure_name: str | None, stage_name: str, locale: PromptLocale
) -> str:
    """Translate a preset stage label when *structure_name* is a known preset."""
    if locale == "zh" or not structure_name:
        return stage_name
    key = STRUCTURE_KEYS.get(structure_name)
    if not key:
        return stage_name
    zh_stages = PRESET_ZH_STAGES[key]
    en_stages = PRESET_EN[key]["stages"]
    try:
        index = zh_stages.index(stage_name)
    except ValueError:
        return stage_name
    if index < len(en_stages):
        return str(en_stages[index])
    return stage_name


def translate_stage_names(
    structure_name: str | None, stages: list[str], locale: PromptLocale
) -> list[str]:
    """Translate a list of stage labels for prompt display."""
    return [translate_preset_stage_name(structure_name, stage, locale) for stage in stages]


def canonical_stage_name(structure_name: str | None, label: str) -> str:
    """Map an English or Chinese stage label back to the stored Chinese name."""
    if not structure_name or structure_name not in STRUCTURE_KEYS:
        return label
    key = STRUCTURE_KEYS[structure_name]
    zh_stages = PRESET_ZH_STAGES[key]
    en_stages = PRESET_EN[key]["stages"]
    if label in zh_stages:
        return label
    if label in en_stages:
        return zh_stages[en_stages.index(label)]
    return label


def index_stage_generation_results(
    parsed: list[object], structure_name: str | None
) -> dict[str, dict]:
    """Index LLM stage JSON by canonical (Chinese) preset names for DB lookup."""
    by_name: dict[str, dict] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        raw_name = str(item.get("name", ""))
        canonical = canonical_stage_name(structure_name, raw_name)
        by_name[canonical] = item
    return by_name
