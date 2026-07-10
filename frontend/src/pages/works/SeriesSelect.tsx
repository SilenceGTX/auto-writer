/** Series dropdown with an inline "new series" creation modal.
 *
 * Shared by the work create form and the work detail panel
 * (``designs/STORY_PAGE_DESIGN.md`` §2.4 / §2.4.1).
 */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["works", "common"]);
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
      notify(t("works:toast.seriesCreated"), "success");
    } catch {
      notify(t("works:toast.seriesCreateFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-field">
      <Select
        label={t("works:series.label")}
        selectedKeys={[props.value === null ? NO_SERIES_KEY : String(props.value)]}
        onChange={(event) => {
          const key = event.target.value;
          props.onChange(key === NO_SERIES_KEY || key === "" ? null : Number(key));
        }}
      >
        <>
          <SelectItem key={NO_SERIES_KEY}>{t("works:series.none")}</SelectItem>
          {props.seriesList.map((series) => (
            <SelectItem key={String(series.id)}>{series.name}</SelectItem>
          ))}
        </>
      </Select>
      <Button
        isIconOnly
        variant="flat"
        aria-label={t("works:series.createAria")}
        onPress={() => setModalOpen(true)}
      >
        <Plus size={18} />
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>{t("works:series.modalTitle")}</ModalHeader>
          <ModalBody>
            <Input label={t("works:series.nameLabel")} value={name} onValueChange={setName} autoFocus />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
              {t("works:actions.confirm")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
