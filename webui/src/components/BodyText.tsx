import type { ReactNode } from "react";

// Mnemosyne's style guides mandate physical action in *asterisks*, dialogue
// plain (see mnemosyne's prompt.ts ACTION_FORMATTING_STATEMENT) -- render
// that as styled emphasis rather than showing the raw asterisks, matching
// WEBUI_NOTES' explicit fix for "low-contrast italic body text": *only*
// the asterisk-marked spans get <em>, never the whole paragraph. Plain
// text nodes, not dangerouslySetInnerHTML -- entity content is
// operator/LLM-authored prose, not sanitized HTML.
const ASTERISK_SPAN = /\*([^*]+)\*/g;

export default function BodyText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, i) => {
        const nodes: ReactNode[] = [];
        let last = 0;
        for (const match of para.matchAll(ASTERISK_SPAN)) {
          const start = match.index ?? 0;
          if (start > last) nodes.push(para.slice(last, start));
          nodes.push(<em key={start}>{match[1]}</em>);
          last = start + match[0].length;
        }
        if (last < para.length) nodes.push(para.slice(last));
        return <p key={i}>{nodes}</p>;
      })}
    </>
  );
}
