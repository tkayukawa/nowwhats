import DOMPurify from "dompurify";
import { marked } from "marked";

// リンクは新しいタブで開き、開いた先から元のページを操作できないようにする
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/** Markdown を HTML に変換する。表示する前に必ず DOMPurify で無害化する（スクリプト等を取り除く） */
export const renderMarkdown = (source: string): string =>
  DOMPurify.sanitize(marked(source, { async: false, gfm: true, breaks: true }));

export const Markdown = ({ source }: { readonly source: string }) => (
  <div
    className="md min-w-0 text-[0.9rem] leading-7 [overflow-wrap:anywhere]"
    // renderMarkdown で無害化済みの HTML だけを渡す
    dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
  />
);
