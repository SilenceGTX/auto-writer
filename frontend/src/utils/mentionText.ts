/** Helpers for building and inserting ``@`` setting-entry markers in text fields. */

/** Return the canonical ``@名称 `` marker inserted by mention UI. */
export function buildMentionMarker(entityName: string): string {
  return `@${entityName} `;
}

/** Replace a value slice with an ``@`` mention marker for *entityName*. */
export function replaceRangeWithMention(
  value: string,
  start: number,
  end: number,
  entityName: string,
): string {
  const marker = buildMentionMarker(entityName);
  return value.slice(0, start) + marker + value.slice(end);
}
