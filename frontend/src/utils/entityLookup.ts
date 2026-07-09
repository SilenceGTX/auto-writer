/** Link the current selection to an existing setting entry via ``@名称 ``. */
import { listEntities, type WorldEntity } from "../api";

/** Return entries whose name exactly equals *name* (trimmed). */
export async function findEntitiesByExactName(
  workId: number,
  name: string,
): Promise<WorldEntity[]> {
  const trimmed = name.trim();
  if (!trimmed) {
    return [];
  }
  const { items } = await listEntities(workId, { search: trimmed, pageSize: 100 });
  return items.filter((entity) => entity.name === trimmed);
}
