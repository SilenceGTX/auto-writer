/** Client-side live word counter for the writing editor.
 *
 * Mirrors the backend ``count_words`` (``app/services/writing_service.py``):
 * each CJK character counts as one word and each run of Latin letters / digits
 * counts as one word, so the in-editor count matches the persisted value.
 */

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;
const LATIN = /[A-Za-z0-9]+/g;

/** Count a chapter's words: CJK chars individually + Latin/number runs. */
export function countWords(text: string): number {
  if (!text) {
    return 0;
  }
  const cjk = text.match(CJK)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;
  return cjk + latin;
}
