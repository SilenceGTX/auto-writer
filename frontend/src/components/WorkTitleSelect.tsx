/** Page-header work switcher rendered as a title-sized dropdown.
 *
 * Loads the user's works and updates ``currentWorkId`` in ``AppContext`` so
 * outline, writing, and other work-scoped pages can switch context without
 * returning to the works list.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectItem } from "@heroui/react";
import { listWorks, type Work } from "../api";
import { useApp } from "../context/AppContext";
import { useToast } from "./Toast";

const WORK_LIST_LIMIT = 100;

interface WorkTitleSelectProps {
  /** Label shown until the works list (or current title) is available. */
  fallback?: string;
}

/** Render a heading-style select for switching the active work. */
export function WorkTitleSelect(props: WorkTitleSelectProps): ReactElement {
  const { t } = useTranslation("works");
  const { currentWorkId, setCurrentWorkId } = useApp();
  const { notify } = useToast();
  const [works, setWorks] = useState<Work[]>([]);

  const loadWorks = useCallback(async () => {
    try {
      const data = await listWorks({
        sortBy: "updated_at",
        order: "desc",
        pageSize: WORK_LIST_LIMIT,
      });
      setWorks(data.items);
    } catch {
      notify(t("toast.loadWorksFailed"), "error");
    }
  }, [notify, t]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  const placeholder =
    works.find((work) => work.id === currentWorkId)?.title ??
    props.fallback ??
    t("titleSelect.placeholder");

  return (
    <Select
      aria-label={t("titleSelect.ariaLabel")}
      className="work-title-select"
      selectedKeys={currentWorkId != null ? [String(currentWorkId)] : []}
      placeholder={placeholder}
      classNames={{
        base: "work-title-select-base",
        trigger: "work-title-select-trigger",
        value: "work-title-select-value",
        innerWrapper: "work-title-select-inner",
      }}
      onSelectionChange={(keys) => {
        const key = Array.from(keys)[0] as string | undefined;
        if (key) {
          setCurrentWorkId(Number(key));
        }
      }}
    >
      {works.map((work) => (
        <SelectItem key={String(work.id)}>{work.title}</SelectItem>
      ))}
    </Select>
  );
}
