import type { ReactNode } from "react";

export default function WorkspacePane({
  paneId,
  title,
  eyebrow,
  focused,
  onFocus,
  onClose,
  children,
}: {
  paneId: string;
  title: string;
  eyebrow?: string;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = `pane-${paneId}-title`;

  return (
    <section
      id={`pane-${paneId}`}
      className={`pane-window${focused ? " is-focused" : ""}`}
      aria-labelledby={titleId}
      data-pane={paneId}
    >
      <header className="pane-titlebar">
        <div className="pane-heading">
          {eyebrow && <span className="pane-eyebrow">{eyebrow}</span>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="pane-actions">
          <button
            type="button"
            className="pane-action"
            aria-label={
              focused ? `Restore ${title} pane` : `Focus ${title} pane`
            }
            title={focused ? "Restore pane" : "Focus pane"}
            onClick={onFocus}
          >
            {focused ? "↙" : "↗"}
          </button>
          <button
            type="button"
            className="pane-action"
            aria-label={`Close ${title} pane`}
            title="Close pane"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>
      <div className="pane-body">{children}</div>
    </section>
  );
}
