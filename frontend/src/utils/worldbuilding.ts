/** Shared helpers for worldbuilding (设定) UI flows. */

import type { EntityCategory } from "../api";

export const DEFAULT_ENTITY_CATEGORY_NAME = "人物";

const ENTITY_NAME_MAX_LENGTH = 200;

/** Resolve the default category id for outline "加入设定", preferring 人物. */
export function defaultEntityCategoryId(categories: EntityCategory[]): number {
  return (
    categories.find((category) => category.name === DEFAULT_ENTITY_CATEGORY_NAME)?.id ??
    categories[0]?.id ??
    0
  );
}

/** Trim and cap a snippet so it fits the entity name field. */
export function entityNameFromSelection(text: string): string {
  return text.trim().slice(0, ENTITY_NAME_MAX_LENGTH);
}
