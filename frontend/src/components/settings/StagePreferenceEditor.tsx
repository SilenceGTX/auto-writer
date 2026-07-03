/** Editor for one generation stage's preferences: friendly sliders + advanced. */
import type { ReactElement } from "react";
import { Accordion, AccordionItem, Input, Slider } from "@heroui/react";
import type { StagePreference } from "../../api";
import {
  CREATIVITY_LEVELS,
  FOCUS_LEVELS,
  LENGTH_LEVELS,
  applyLevel,
  detectLevel,
  type PreferenceLevel,
} from "../../utils/preferences";

interface StagePreferenceEditorProps {
  title: string;
  value: StagePreference;
  onChange: (next: StagePreference) => void;
}

/** A 3-step slider bound to a set of preset preference levels. */
function LevelSlider(props: {
  label: string;
  levels: PreferenceLevel[];
  value: StagePreference;
  onChange: (next: StagePreference) => void;
}): ReactElement {
  const detected = detectLevel(props.levels, props.value);
  const current = detected === -1 ? "自定义" : props.levels[detected].label;
  return (
    <div className="level-slider">
      <div className="level-slider-head">
        <span className="level-slider-name">{props.label}</span>
        <span className="level-slider-value">{current}</span>
      </div>
      <Slider
        aria-label={props.label}
        size="sm"
        minValue={0}
        maxValue={props.levels.length - 1}
        step={1}
        hideValue
        value={detected === -1 ? 1 : detected}
        onChange={(value) => {
          const index = Array.isArray(value) ? value[0] : value;
          props.onChange(applyLevel(props.value, props.levels[index]));
        }}
      />
      <div className="level-ticks">
        {props.levels.map((level) => (
          <span key={level.label}>{level.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Render sliders for the three preset dimensions plus raw advanced inputs. */
export function StagePreferenceEditor(props: StagePreferenceEditorProps): ReactElement {
  const { value, onChange } = props;

  function setField(key: keyof StagePreference, raw: string): void {
    if (key === "max_tokens") {
      onChange({ ...value, max_tokens: raw.trim() === "" ? null : Number(raw) });
      return;
    }
    onChange({ ...value, [key]: Number(raw) });
  }

  return (
    <section className="stage-pref">
      <h3>{props.title}</h3>
      <LevelSlider label="创造力" levels={CREATIVITY_LEVELS} value={value} onChange={onChange} />
      <LevelSlider label="聚焦度" levels={FOCUS_LEVELS} value={value} onChange={onChange} />
      <LevelSlider label="篇幅" levels={LENGTH_LEVELS} value={value} onChange={onChange} />

      <Accordion isCompact>
        <AccordionItem key="advanced" aria-label="高级设置" title="高级设置">
          <div className="form-grid">
            <Input
              label="temperature"
              type="number"
              value={String(value.temperature)}
              onValueChange={(raw) => setField("temperature", raw)}
            />
            <Input
              label="top_p"
              type="number"
              value={String(value.top_p)}
              onValueChange={(raw) => setField("top_p", raw)}
            />
            <Input
              label="presence_penalty"
              type="number"
              value={String(value.presence_penalty)}
              onValueChange={(raw) => setField("presence_penalty", raw)}
            />
            <Input
              label="frequency_penalty"
              type="number"
              value={String(value.frequency_penalty)}
              onValueChange={(raw) => setField("frequency_penalty", raw)}
            />
            <Input
              label="max_tokens"
              type="number"
              value={value.max_tokens === null ? "" : String(value.max_tokens)}
              onValueChange={(raw) => setField("max_tokens", raw)}
            />
          </div>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
