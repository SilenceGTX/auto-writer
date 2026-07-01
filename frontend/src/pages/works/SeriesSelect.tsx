/** Series dropdown with an inline "new series" creation modal.
 *
 * Shared by the work create form and the work detail panel
 * (``designs/STORY_PAGE_DESIGN.md`` §2.4 / §2.4.1).
 */
import { useState, type ReactElement } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { Plus } from "lucide-react";
import { createSeries, type Series } from "../../api";
import { useToast } from "../../components/Toast";

const NO_SERIES_KEY = "__none__";

interface SeriesSelectProps {
  seriesList: Series[];
  value: number | null;
  onChange: (seriesId: number | null) => void;
  onSeriesCreated: (series: Series) => void;
}

/** Render a series selector with a button to create a new series inline. */
export function SeriesSelect(props: SeriesSelectProps): ReactElement {
  const { notify } = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSaving(true);
    try {
      const created = await createSeries(trimmed);
      props.onSeriesCreated(created);
      props.onChange(created.id);
      setName("");
      setModalOpen(false);
      notify("系列已创建", "success");
    } catch {
      notify("创建系列失败（名称可能重复）", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-field">
      <Select
        label="所属系列"
        selectedKeys={[props.value === null ? NO_SERIES_KEY : String(props.value)]}
        onChange={(event) => {
          const key = event.target.value;
          props.onChange(key === NO_SERIES_KEY || key === "" ? null : Number(key));
        }}
      >
        <>
          <SelectItem key={NO_SERIES_KEY}>不归类</SelectItem>
          {props.seriesList.map((series) => (
            <SelectItem key={String(series.id)}>{series.name}</SelectItem>
          ))}
        </>
      </Select>
      <Button
        isIconOnly
        variant="flat"
        aria-label="新建系列"
        onPress={() => setModalOpen(true)}
      >
        <Plus size={18} />
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>新建系列</ModalHeader>
          <ModalBody>
            <Input label="系列名称" value={name} onValueChange={setName} autoFocus />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              取消
            </Button>
            <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
              确认
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
