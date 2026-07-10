/** Inspiration detail modal: full content, tag editing, and actions.
 *
 * Implements ``INSIGHTS_PAGE_DESIGN.md`` §2.1: view the full snippet, copy it,
 * insert it back into the writing editor ("一键回插"), jump to its source, and
 * classify it with reusable colored tags.
 */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Copy, CornerDownLeft, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Inspiration, Tag } from "../../api";
import { formatTimestamp, sourceLabel } from "../../utils/inspiration";

interface InspirationDetailModalProps {
  inspiration: Inspiration;
  allTags: Tag[];
  onClose: () => void;
  onCopy: (content: string) => void;
  onInsertBack: (inspiration: Inspiration) => void;
  onJumpSource: (inspiration: Inspiration) => void;
  onDelete: (inspiration: Inspiration) => void;
  onSetTags: (inspiration: Inspiration, tagIds: number[]) => void;
  onCreateTag: (name: string) => void;
}

/** Render the full-detail modal for a single inspiration. */
export function InspirationDetailModal(props: InspirationDetailModalProps): ReactElement {
  const { t } = useTranslation("inspiration");
  const { inspiration } = props;
  const [newTag, setNewTag] = useState("");
  const selectedIds = new Set(inspiration.tags.map((tag) => tag.id));

  function toggleTag(tag: Tag): void {
    const next = new Set(selectedIds);
    if (next.has(tag.id)) {
      next.delete(tag.id);
    } else {
      next.add(tag.id);
    }
    props.onSetTags(inspiration, Array.from(next));
  }

  function handleCreateTag(): void {
    const name = newTag.trim();
    if (!name) {
      return;
    }
    props.onCreateTag(name);
    setNewTag("");
  }

  const canJump = inspiration.work_id != null || inspiration.source_page != null;

  return (
    <Modal isOpen onClose={props.onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="inspiration-modal-head">
          <span>{t("modal.title")}</span>
          <span className="inspiration-modal-meta">
            {sourceLabel(inspiration.source_page, t)} · {formatTimestamp(inspiration.created_at)}
          </span>
        </ModalHeader>
        <ModalBody>
          <p className="inspiration-detail-content">{inspiration.content}</p>

          <div className="inspiration-tag-editor">
            <span className="inspiration-tag-editor-label">{t("modal.tagsLabel")}</span>
            <div className="inspiration-tag-chips">
              {props.allTags.length === 0 && (
                <span className="assistant-hint">{t("modal.noTagsHint")}</span>
              )}
              {props.allTags.map((tag) => {
                const active = selectedIds.has(tag.id);
                return (
                  <Chip
                    key={tag.id}
                    size="sm"
                    variant={active ? "solid" : "bordered"}
                    className="inspiration-tag-toggle"
                    style={
                      active && tag.color
                        ? { backgroundColor: tag.color, color: "#fff", cursor: "pointer" }
                        : { cursor: "pointer" }
                    }
                    onClick={() => toggleTag(tag)}
                  >
                    {tag.name}
                  </Chip>
                );
              })}
            </div>
            <div className="inspiration-tag-create">
              <Input
                size="sm"
                aria-label={t("modal.newTagAria")}
                placeholder={t("modal.newTagPlaceholder")}
                value={newTag}
                onValueChange={setNewTag}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <Button
                size="sm"
                variant="flat"
                isIconOnly
                aria-label={t("modal.addTagAria")}
                onPress={handleCreateTag}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="inspiration-modal-actions">
          <Button
            variant="flat"
            startContent={<Copy size={15} />}
            onPress={() => props.onCopy(inspiration.content)}
          >
            {t("modal.copy")}
          </Button>
          <Button
            variant="flat"
            startContent={<CornerDownLeft size={15} />}
            title={t("modal.insertBackTitle")}
            onPress={() => props.onInsertBack(inspiration)}
          >
            {t("modal.insertBack")}
          </Button>
          <Button
            variant="flat"
            startContent={<ExternalLink size={15} />}
            isDisabled={!canJump}
            onPress={() => props.onJumpSource(inspiration)}
          >
            {t("modal.jumpSource")}
          </Button>
          <Button
            color="danger"
            variant="light"
            startContent={<Trash2 size={15} />}
            onPress={() => props.onDelete(inspiration)}
          >
            {t("modal.delete")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
