/** Story-structure dropdown with stage-tag preview and a custom-structure modal.
 *
 * Shared by the work create form and detail panel
 * (``designs/STORY_PAGE_DESIGN.md`` §2.4 / §2.4.2 / §2.4.3).
 */
import { useState, type ReactElement } from "react";
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

interface StructureSelectProps {
  structures: StoryStructure[];
  value: number | null;
  onChange: (structureId: number | null) => void;
  onStructureCreated: (structure: StoryStructure) => void;
}

/** Render a structure selector, its stage tags, and a custom-structure creator. */
export function StructureSelect(props: StructureSelectProps): ReactElement {
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
      notify("请填写结构名称并以 - 分隔阶段", "error");
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
      notify("自定义结构已创建", "success");
    } catch {
      notify("创建结构失败", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="structure-field">
      <div className="inline-field">
        <Select
          label="故事结构"
          selectedKeys={props.value === null ? [] : [String(props.value)]}
          onChange={(event) => {
            const key = event.target.value;
            props.onChange(key === "" ? null : Number(key));
          }}
        >
          {props.structures.map((structure) => (
            <SelectItem key={String(structure.id)}>{structure.name}</SelectItem>
          ))}
        </Select>
        <Button
          isIconOnly
          variant="flat"
          aria-label="自定义结构"
          onPress={() => setModalOpen(true)}
        >
          <Plus size={18} />
        </Button>
      </div>

      {selected && selected.stages.length > 0 && (
        <div className="stage-tags" aria-label="阶段">
          {selected.stages.map((stage, index) => (
            <Chip key={`${stage}-${index}`} size="sm" variant="flat">
              {stage}
            </Chip>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>自定义故事结构</ModalHeader>
          <ModalBody className="modal-form">
            <Input label="结构名称" value={name} onValueChange={setName} autoFocus />
            <Input
              label="故事结构"
              description="以 - 分隔，如 起因-经过-结果"
              value={stagesText}
              onValueChange={setStagesText}
            />
            <Textarea label="描述" minRows={3} value={description} onValueChange={setDescription} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              取消
            </Button>
            <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
