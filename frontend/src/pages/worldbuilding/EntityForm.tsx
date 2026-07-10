/** Assistant-panel form to create or edit a worldbuilding entry.
 *
 * Implements ``designs/CONCEPT_PAGE_DESIGN.md`` §3.4 / §4: name, category,
 * description, and free-form key-value properties with the property-name
 * reuse / template mechanism (candidate names derived per category).
 */
import { useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
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
import { translateCategoryName } from "../../utils/entityCategoryI18n";

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
  const { t } = useTranslation(["concept", "common"]);
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
      notify(t("concept:toast.nameRequired"), "error");
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
      notify(isEdit ? t("concept:toast.entitySaved") : t("concept:toast.entityCreated"), "success");
    } catch {
      notify(
        isEdit ? t("concept:toast.entitySaveFailed") : t("concept:toast.entityCreateFailed"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={props.embedded ? "entity-form-embedded" : "assistant-section work-form"}>
      {!props.embedded && (
        <h2>{isEdit ? t("concept:form.editTitle") : t("concept:form.createTitle")}</h2>
      )}
      <Input
        label={t("concept:form.nameLabel")}
        value={name}
        onValueChange={setName}
        autoFocus
        isRequired
      />
      <Select
        label={t("concept:form.categoryLabel")}
        selectedKeys={[String(categoryId)]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined;
          if (key) setCategoryId(Number(key));
        }}
      >
        {props.categories.map((category) => (
          <SelectItem key={String(category.id)}>{translateCategoryName(category, t)}</SelectItem>
        ))}
      </Select>
      <Textarea
        label={t("concept:form.descriptionLabel")}
        minRows={3}
        value={description}
        onValueChange={setDescription}
        placeholder={t("concept:form.descriptionPlaceholder")}
      />

      <div className="entity-properties">
        <div className="entity-properties-head">
          <span>{t("concept:form.propertiesTitle")}</span>
          <Button
            size="sm"
            variant="flat"
            startContent={<Plus size={14} />}
            onPress={() => addProperty()}
          >
            {t("concept:form.addProperty")}
          </Button>
        </div>
        {properties.map((prop, index) => (
          <div className="entity-property-row" key={index}>
            <Input
              aria-label={t("concept:form.propertyNameAria")}
              size="sm"
              placeholder={t("concept:form.propertyNamePlaceholder")}
              list="entity-property-names"
              value={prop.name}
              onValueChange={(value) => updateProperty(index, { name: value })}
            />
            <Input
              aria-label={t("concept:form.propertyValueAria")}
              size="sm"
              placeholder={t("concept:form.propertyValuePlaceholder")}
              value={prop.value}
              onValueChange={(value) => updateProperty(index, { value })}
            />
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label={t("concept:form.deletePropertyAria")}
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
            <span>{t("concept:form.commonProperties")}</span>
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
            <span>{t("concept:form.referencesTitle")}</span>
            <p>{t("concept:form.referencesEmpty")}</p>
          </div>
          <p className="entity-timestamps">
            {t("concept:form.timestamps", {
              created: entity.created_at,
              updated: entity.updated_at,
            })}
          </p>
        </div>
      )}

      <div className="form-actions">
        <Button variant="light" onPress={props.onCancel}>
          {t("common:cancel")}
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
          {isEdit ? t("common:save") : t("concept:form.createSubmit")}
        </Button>
      </div>
    </section>
  );
}
