/** Assistant-panel form to create or edit a worldbuilding entry.
 *
 * Implements ``designs/CONCEPT_PAGE_DESIGN.md`` §3.4 / §4: name, category,
 * description, and free-form key-value properties with the property-name
 * reuse / template mechanism (candidate names derived per category).
 */
import { useEffect, useState, type ReactElement } from "react";
import { Button, Chip, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import {
  createEntity,
  listPropertyNames,
  updateEntity,
  type EntityCategory,
  type EntityProperty,
  type WorldEntity,
} from "../../api";
import { useToast } from "../../components/Toast";

const TEMPLATE_LIMIT = 5;

interface EntityFormProps {
  workId: number;
  categories: EntityCategory[];
  defaultCategoryId: number;
  entity: WorldEntity | null;
  initialName?: string;
  embedded?: boolean;
  onSaved: (entity: WorldEntity) => void;
  onCancel: () => void;
}

/** Render the contextual create/edit form for a worldbuilding entry. */
export function EntityForm(props: EntityFormProps): ReactElement {
  const { entity } = props;
  const isEdit = entity !== null;
  const { notify } = useToast();

  const [name, setName] = useState(entity?.name ?? props.initialName ?? "");
  const [categoryId, setCategoryId] = useState(entity?.category_id ?? props.defaultCategoryId);
  const [description, setDescription] = useState(entity?.description ?? "");
  const [properties, setProperties] = useState<EntityProperty[]>(entity?.properties ?? []);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const names = await listPropertyNames(categoryId);
        if (!active) return;
        setCandidates(names);
        // Property template: prefill empty rows for a new entry only.
        if (!isEdit) {
          setProperties((current) =>
            current.length > 0
              ? current
              : names.slice(0, TEMPLATE_LIMIT).map((propName) => ({ name: propName, value: "" })),
          );
        }
      } catch {
        if (active) setCandidates([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [categoryId, isEdit]);

  function updateProperty(index: number, patch: Partial<EntityProperty>): void {
    setProperties((current) =>
      current.map((prop, i) => (i === index ? { ...prop, ...patch } : prop)),
    );
  }

  function removeProperty(index: number): void {
    setProperties((current) => current.filter((_, i) => i !== index));
  }

  function addProperty(propName = ""): void {
    setProperties((current) => [...current, { name: propName, value: "" }]);
  }

  const usedNames = new Set(properties.map((prop) => prop.name));
  const unusedCandidates = candidates.filter((propName) => !usedNames.has(propName));

  async function handleSave(): Promise<void> {
    if (!name.trim()) {
      notify("请填写条目名称", "error");
      return;
    }
    const cleaned = properties
      .map((prop) => ({ name: prop.name.trim(), value: prop.value }))
      .filter((prop) => prop.name);

    setSaving(true);
    try {
      const saved = isEdit
        ? await updateEntity(entity.id, {
            name: name.trim(),
            category_id: categoryId,
            description,
            properties: cleaned,
          })
        : await createEntity(props.workId, {
            category_id: categoryId,
            name: name.trim(),
            description,
            properties: cleaned,
          });
      props.onSaved(saved);
      notify(isEdit ? "条目已保存" : "条目已创建", "success");
    } catch {
      notify(isEdit ? "保存条目失败" : "创建条目失败", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={props.embedded ? "entity-form-embedded" : "assistant-section work-form"}>
      {!props.embedded && <h2>{isEdit ? "编辑条目" : "新建条目"}</h2>}
      <Input label="条目名称" value={name} onValueChange={setName} autoFocus isRequired />
      <Select
        label="设定种类"
        selectedKeys={[String(categoryId)]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined;
          if (key) setCategoryId(Number(key));
        }}
      >
        {props.categories.map((category) => (
          <SelectItem key={String(category.id)}>{category.name}</SelectItem>
        ))}
      </Select>
      <Textarea
        label="描述"
        minRows={3}
        value={description}
        onValueChange={setDescription}
        placeholder="对该条目的简短描述..."
      />

      <div className="entity-properties">
        <div className="entity-properties-head">
          <span>属性</span>
          <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => addProperty()}>
            添加属性
          </Button>
        </div>
        {properties.map((prop, index) => (
          <div className="entity-property-row" key={index}>
            <Input
              aria-label="属性名称"
              size="sm"
              placeholder="名称"
              list="entity-property-names"
              value={prop.name}
              onValueChange={(value) => updateProperty(index, { name: value })}
            />
            <Input
              aria-label="属性值"
              size="sm"
              placeholder="值"
              value={prop.value}
              onValueChange={(value) => updateProperty(index, { value })}
            />
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label="删除属性"
              onPress={() => removeProperty(index)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        <datalist id="entity-property-names">
          {candidates.map((propName) => (
            <option key={propName} value={propName} />
          ))}
        </datalist>
        {unusedCandidates.length > 0 && (
          <div className="entity-property-suggest">
            <span>常用属性：</span>
            {unusedCandidates.map((propName) => (
              <Chip
                key={propName}
                size="sm"
                variant="flat"
                className="entity-suggest-chip"
                onClick={() => addProperty(propName)}
              >
                + {propName}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {isEdit && (
        <div className="entity-meta">
          <div className="entity-reference">
            <span>引用情况</span>
            <p>暂无引用（待 @ 引用功能上线后展示）。</p>
          </div>
          <p className="entity-timestamps">
            创建于 {entity.created_at} · 更新于 {entity.updated_at}
          </p>
        </div>
      )}

      <div className="form-actions">
        <Button variant="light" onPress={props.onCancel}>
          取消
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
          {isEdit ? "保存" : "创建条目"}
        </Button>
      </div>
    </section>
  );
}
