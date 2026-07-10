/** Story-structure dropdown with stage-tag preview and a custom-structure modal.
 *
 * Shared by the work create form and detail panel
 * (``designs/STORY_PAGE_DESIGN.md`` §2.4 / §2.4.2 / §2.4.3).
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
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Plus } from "lucide-react";
import { createStructure, type StoryStructure } from "../../api";
import { useToast } from "../../components/Toast";
import { translatePresetStageName, translateStructureName } from "../../utils/storyStructureI18n";

interface StructureSelectProps {
  structures: StoryStructure[];
  value: number | null;
  onChange: (structureId: number | null) => void;
  onStructureCreated: (structure: StoryStructure) => void;
}

/** Render a structure selector, its stage tags, and a custom-structure creator. */
export function StructureSelect(props: StructureSelectProps): ReactElement {
  const { t } = useTranslation(["works", "common"]);
  const { notify } = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [stagesText, setStagesText] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = props.structures.find((item) => item.id === props.value) ?? null;

  async function handleCreate(): Promise<void> {
    const stages = stagesText
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!name.trim() || stages.length === 0) {
      notify(t("works:toast.structureFieldsRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      const created = await createStructure({
        name: name.trim(),
        stages,
        description: description.trim() || undefined,
      });
      props.onStructureCreated(created);
      props.onChange(created.id);
      setName("");
      setStagesText("");
      setDescription("");
      setModalOpen(false);
      notify(t("works:toast.structureCreated"), "success");
    } catch {
      notify(t("works:toast.structureCreateFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="structure-field">
      <div className="inline-field">
        <Select
          label={t("works:structure.label")}
          selectedKeys={props.value === null ? [] : [String(props.value)]}
          onChange={(event) => {
            const key = event.target.value;
            props.onChange(key === "" ? null : Number(key));
          }}
        >
          {props.structures.map((structure) => (
            <SelectItem key={String(structure.id)}>{translateStructureName(structure, t)}</SelectItem>
          ))}
        </Select>
        <Button
          isIconOnly
          variant="flat"
          aria-label={t("works:structure.createAria")}
          onPress={() => setModalOpen(true)}
        >
          <Plus size={18} />
        </Button>
      </div>

      {selected && selected.stages.length > 0 && (
        <div className="stage-tags" aria-label={t("works:structure.stagesAria")}>
          {selected.stages.map((stage, index) => (
            <Chip key={`${stage}-${index}`} size="sm" variant="flat">
              {translatePresetStageName(selected.name, stage, t)}
            </Chip>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>{t("works:structure.modalTitle")}</ModalHeader>
          <ModalBody className="modal-form">
            <Input label={t("works:structure.nameLabel")} value={name} onValueChange={setName} autoFocus />
            <Input
              label={t("works:structure.stagesLabel")}
              description={t("works:structure.stagesDescription")}
              value={stagesText}
              onValueChange={setStagesText}
            />
            <Textarea
              label={t("works:structure.descriptionLabel")}
              minRows={3}
              value={description}
              onValueChange={setDescription}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
              {t("common:save")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
