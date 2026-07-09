/** Work status values stored in the API/DB and their display mapping (``designs/I18N.md`` §3.2 D6). */

export const WORK_STATUS_VALUES = ["创作中", "已完成", "搁置"] as const;

export type WorkStatusValue = (typeof WORK_STATUS_VALUES)[number];

const STATUS_I18N_KEYS: Record<WorkStatusValue, string> = {
  创作中: "works:status.drafting",
  已完成: "works:status.completed",
  搁置: "works:status.onHold",
};

/** Return the i18n key used to label a stored work status value. */
export function workStatusLabelKey(status: string): string {
  return STATUS_I18N_KEYS[status as WorkStatusValue] ?? status;
}

/** Map a stored work status to a chip color. */
export function workStatusColor(status: string): "primary" | "success" | "default" {
  if (status === "已完成") return "success";
  if (status === "创作中") return "primary";
  return "default";
}
