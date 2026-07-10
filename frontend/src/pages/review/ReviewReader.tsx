/** Review reader: TOC, reading progress, chapter navigation, and full-text view.
 *
 * Implements ``designs/REVIEW_PAGE_DESIGN.md`` §2: a side table of contents to
 * jump between chapters, a reading-progress indicator, previous/next chapter
 * controls, and a read-only rendering of the current chapter's body. Selecting
 * text exposes "引用到审阅" (quote to the AI); "加入灵感" lives in the assistant panel.
 */
import { useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, Progress } from "@heroui/react";
import { ChevronLeft, ChevronRight, MessageSquareQuote } from "lucide-react";
import type { Chapter } from "../../api";
import { getActiveSelectionText } from "../../utils/selection";

interface ReviewReaderProps {
  chapters: Chapter[];
  selectedId: number | null;
  onSelect: (chapterId: number) => void;
  title: string | null;
  content: string | null;
  loading: boolean;
  highlight?: string | null;
  onQuote: (text: string) => void;
}

/** Render a paragraph, wrapping the first occurrence of the highlight in a mark. */
function renderParagraph(text: string, highlight: string | null | undefined): ReactNode {
  if (!highlight) {
    return text;
  }
  const index = text.indexOf(highlight);
  if (index < 0) {
    return text;
  }
  return (
    <>
      {text.slice(0, index)}
      <mark className="review-highlight">{text.slice(index, index + highlight.length)}</mark>
      {text.slice(index + highlight.length)}
    </>
  );
}

/** Render the chapter table of contents alongside the reading view. */
export function ReviewReader(props: ReviewReaderProps): ReactElement {
  const { t } = useTranslation("review");
  const index = props.chapters.findIndex((chapter) => chapter.id === props.selectedId);
  const current = index >= 0 ? props.chapters[index] : undefined;
  const total = props.chapters.length;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  const contentRef = useRef<HTMLElement | null>(null);
  const capturedQuote = useRef<string | null>(null);

  const paragraphs = useMemo(
    () => (props.content ?? "").split(/\n+/).filter((line) => line.trim().length > 0),
    [props.content],
  );

  // Scroll the highlighted source passage into view after a 来源跳转 jump.
  useEffect(() => {
    if (!props.highlight) {
      return;
    }
    const mark = contentRef.current?.querySelector(".review-highlight");
    mark?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [props.highlight, props.content]);

  function go(delta: number): void {
    const next = props.chapters[index + delta];
    if (next) {
      props.onSelect(next.id);
    }
  }

  function quoteSelection(): void {
    const text = (capturedQuote.current ?? getActiveSelectionText()).trim();
    capturedQuote.current = null;
    if (text) {
      props.onQuote(text);
    }
  }

  const chapterHeading = current
    ? `${t("reader.chapterLabel", { number: current.chapter_number })}${
        current.title ? ` · ${current.title}` : ""
      }`
    : props.title;

  return (
    <div className="review-reader">
      <aside className="review-toc" aria-label={t("reader.tocAria")}>
        <h2>{t("reader.tocTitle")}</h2>
        <ul>
          {props.chapters.map((chapter) => (
            <li key={chapter.id}>
              <button
                type="button"
                className={
                  chapter.id === props.selectedId ? "review-toc-item active" : "review-toc-item"
                }
                onClick={() => props.onSelect(chapter.id)}
              >
                <span className="review-toc-number">
                  {t("reader.chapterLabel", { number: chapter.chapter_number })}
                </span>
                {chapter.title && <span className="review-toc-title">{chapter.title}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="review-main">
        <div className="review-progress">
          <span>
            {total > 0
              ? t("reader.progress", { current: index + 1, total })
              : t("reader.noChapters")}
          </span>
          <Progress
            aria-label={t("reader.progressAria")}
            size="sm"
            value={progress}
            className="review-progress-bar"
          />
          <div className="review-nav">
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              aria-label={t("reader.prevChapter")}
              isDisabled={index <= 0}
              onPress={() => go(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              aria-label={t("reader.nextChapter")}
              isDisabled={index < 0 || index >= total - 1}
              onPress={() => go(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div className="review-toolbar">
          <Button
            size="sm"
            variant="flat"
            startContent={<MessageSquareQuote size={15} />}
            onMouseDown={(event) => {
              event.preventDefault();
              capturedQuote.current = getActiveSelectionText();
            }}
            onPress={quoteSelection}
          >
            {t("reader.quoteToReview")}
          </Button>
        </div>

        <article className="review-content" ref={contentRef}>
          <h3 className="review-content-title">{chapterHeading}</h3>
          {props.loading ? (
            <p className="assistant-hint">{t("reader.loading")}</p>
          ) : paragraphs.length === 0 ? (
            <p className="assistant-hint">{t("reader.emptyContent")}</p>
          ) : (
            paragraphs.map((paragraph, idx) => (
              <p key={idx}>{renderParagraph(paragraph, props.highlight)}</p>
            ))
          )}
        </article>
      </div>
    </div>
  );
}
