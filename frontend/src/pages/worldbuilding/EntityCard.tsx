/** A worldbuilding entry card: name + a few key properties, copy/delete (``§3.2``). */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "@heroui/react";
import { Copy, Trash2 } from "lucide-react";
import type { WorldEntity } from "../../api";

const PREVIEW_PROPERTIES = 3;

interface EntityCardProps {
  entity: WorldEntity;
  selected: boolean;
  onSelect: (entity: WorldEntity) => void;
  onCopy: (entity: WorldEntity) => void;
  onDelete: (entity: WorldEntity) => void;
}

/** Render one entry card with a short property preview and row actions. */
export function EntityCard(props: EntityCardProps): ReactElement {
  const { t } = useTranslation("concept");
  const { entity } = props;
  const preview = entity.properties.filter((prop) => prop.value.trim()).slice(0, PREVIEW_PROPERTIES);

  return (
    <div
      className={`entity-card ${props.selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect(entity)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect(entity);
        }
      }}
    >
      <div className="entity-card-head">
        <strong className="entity-card-name">{entity.name}</strong>
        <div className="entity-card-actions">
          <Tooltip content={t("entity.copy")}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t("entity.copyAria")}
              onPress={() => props.onCopy(entity)}
            >
              <Copy size={15} />
            </Button>
          </Tooltip>
          <Tooltip content={t("entity.delete")} color="danger">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label={t("entity.deleteAria")}
              onPress={() => props.onDelete(entity)}
            >
              <Trash2 size={15} />
            </Button>
          </Tooltip>
        </div>
      </div>
      {entity.description && <p className="entity-card-desc">{entity.description}</p>}
      {preview.length > 0 && (
        <dl className="entity-card-props">
          {preview.map((prop, index) => (
            <div key={index}>
              <dt>{prop.name}</dt>
              <dd>{prop.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
