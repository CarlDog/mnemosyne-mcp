import { memo } from "react";
import type { ReactNode } from "react";

// Mnemosyne's style guides mandate physical action in *asterisks*, dialogue
// plain (see mnemosyne's prompt.ts ACTION_FORMATTING_STATEMENT) -- render
// that as styled emphasis rather than showing the raw asterisks, matching
// WEBUI_NOTES' explicit fix for "low-contrast italic body text": *only*
// the asterisk-marked spans get <em>, never the whole paragraph. Plain
// text nodes, not dangerouslySetInnerHTML -- entity content is
// operator/LLM-authored prose, not sanitized HTML.
const ASTERISK_SPAN = /\*([^*]+)\*/g;
const PARAGRAPH_BREAK = /\n{2,}/g;

const LEAD_ACTION_CLASS = "body-text__action body-text__action--lead";
const QUIET_ACTION_CLASS = "body-text__action body-text__action--quiet";

function splitParagraphs(text: string) {
  const paragraphs: { text: string; start: number }[] = [];
  let start = 0;

  for (const match of text.matchAll(PARAGRAPH_BREAK)) {
    const end = match.index ?? start;
    paragraphs.push({ text: text.slice(start, end), start });
    start = end + match[0].length;
  }

  paragraphs.push({ text: text.slice(start), start });
  return paragraphs;
}

// memo: the only prop is a string, and ContinueScenePage keeps a
// (potentially very long) generated beat mounted next to a controlled
// textarea -- without memo every keystroke re-runs the paragraph split
// and regex parse over the whole beat.
export default memo(function BodyText({ text }: { text: string }) {
  const paragraphs = splitParagraphs(text);
  let actionIndex = 0;

  return (
    <>
      {paragraphs.map((paragraph) => {
        const nodes: ReactNode[] = [];
        let last = 0;
        for (const match of paragraph.text.matchAll(ASTERISK_SPAN)) {
          const start = match.index ?? 0;
          if (start > last) nodes.push(paragraph.text.slice(last, start));
          const className =
            actionIndex === 0 ? LEAD_ACTION_CLASS : QUIET_ACTION_CLASS;
          nodes.push(
            <em className={className} key={`action-${paragraph.start + start}`}>
              {match[1]}
            </em>,
          );
          actionIndex += 1;
          last = start + match[0].length;
        }
        if (last < paragraph.text.length) {
          nodes.push(paragraph.text.slice(last));
        }
        return (
          <p key={`paragraph-${paragraph.start}-${paragraph.text.length}`}>
            {nodes}
          </p>
        );
      })}
    </>
  );
});
