import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { listStories } from "../api/client";
import type { Mode } from "../api/types";
import { useApi } from "../hooks/useApi";
import Icon from "./Icon";
import ThemeSwitcher from "./ThemeSwitcher";

export type WorkspaceSection = "stories" | "library" | "continue";

export interface WorkspaceShellProps {
  storyId?: string;
  storyName?: string;
  active?: WorkspaceSection;
  title?: ReactNode;
  eyebrow?: ReactNode;
  headerActions?: ReactNode;
  dock?: ReactNode;
  mode?: Mode;
  children?: ReactNode;
}

function navClassName(isActive: boolean): string {
  return `story-rail-link${isActive ? " is-active" : ""}`;
}

export default function WorkspaceShell({
  storyId,
  storyName,
  active,
  title,
  eyebrow,
  headerActions,
  dock,
  mode,
  children,
}: WorkspaceShellProps) {
  const location = useLocation();
  const storiesState = useApi(listStories, []);
  const [railOpen, setRailOpen] = useState(false);
  const railId = useId();
  const railRef = useRef<HTMLElement>(null);
  const railCloseRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const inferredActive: WorkspaceSection | undefined =
    location.pathname === "/"
      ? "stories"
      : location.pathname.endsWith("/continue")
        ? "continue"
        : storyId
          ? "library"
          : undefined;
  const currentSection = active ?? inferredActive;

  const fetchedStoryName =
    storiesState.status === "ready" && storyId
      ? storiesState.data.stories.find((story) => story.id === storyId)?.name
      : undefined;
  const currentStoryName = storyName ?? fetchedStoryName;
  const resolvedTitle = title ?? currentStoryName ?? "Stories";
  const resolvedEyebrow =
    eyebrow ?? (storyId ? "Current story" : "Mnemosyne archive");
  const storyBase = storyId
    ? `/stories/${encodeURIComponent(storyId)}`
    : undefined;

  useEffect(() => {
    const titleText =
      typeof resolvedTitle === "string" ? resolvedTitle : "Mnemosyne";
    const purpose =
      typeof resolvedEyebrow === "string" ? resolvedEyebrow : currentSection;
    document.title = [titleText, purpose, "Mnemosyne"]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(" — ");
  }, [currentSection, resolvedEyebrow, resolvedTitle]);

  function openRail() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setRailOpen(true);
  }

  function closeRail() {
    setRailOpen(false);
    const focusTarget = previousFocusRef.current;
    window.requestAnimationFrame(() => focusTarget?.focus());
  }

  useEffect(() => {
    if (!railOpen) return;

    railCloseRef.current?.focus();
    const trapRailFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRail();
        return;
      }
      if (event.key !== "Tab") return;

      const rail = railRef.current;
      if (!rail) return;
      const focusable = Array.from(
        rail.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !rail.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !rail.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapRailFocus);
    return () => document.removeEventListener("keydown", trapRailFocus);
  }, [railOpen]);

  return (
    <div
      className={`workspace-shell${dock ? " has-dock" : ""}`}
      data-active={currentSection}
      data-mode={mode}
    >
      <a className="skip-link" href="#workspace-main">
        Skip to main content
      </a>
      <button
        type="button"
        className="story-rail-backdrop"
        aria-label="Dismiss story navigation"
        onClick={closeRail}
        hidden={!railOpen}
      />

      <aside
        ref={railRef}
        id={railId}
        className={`story-rail${railOpen ? " is-open" : ""}`}
        aria-label="Story navigation"
      >
        <div className="story-rail-header">
          <Link to="/" className="story-rail-brand" onClick={closeRail}>
            <span className="story-rail-brand-mark" aria-hidden="true">
              <Icon name="spark" size={18} />
            </span>
            <span>Mnemosyne</span>
          </Link>
          <button
            ref={railCloseRef}
            type="button"
            className="story-rail-close"
            aria-label="Close story navigation"
            onClick={closeRail}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="story-rail-nav" aria-label="Workspace">
          <p className="story-rail-section-title">Workspace</p>
          <Link
            to="/"
            className={navClassName(currentSection === "stories")}
            aria-current={currentSection === "stories" ? "page" : undefined}
            onClick={closeRail}
          >
            <Icon name="archive" size={18} />
            <span>All stories</span>
          </Link>
          {storyBase && (
            <>
              <Link
                to={storyBase}
                className={navClassName(currentSection === "library")}
                aria-current={currentSection === "library" ? "page" : undefined}
                onClick={closeRail}
              >
                <Icon name="library" size={18} />
                <span>Story library</span>
              </Link>
              <Link
                to={`${storyBase}/continue`}
                className={navClassName(currentSection === "continue")}
                aria-current={
                  currentSection === "continue" ? "page" : undefined
                }
                onClick={closeRail}
              >
                <Icon name="quill" size={18} />
                <span>Continue scene</span>
              </Link>
            </>
          )}
        </nav>

        <nav className="story-rail-stories" aria-label="Stories">
          <p className="story-rail-section-title">Stories</p>
          {storiesState.status === "loading" && (
            <p className="story-rail-state" role="status">
              Loading stories…
            </p>
          )}
          {storiesState.status === "error" && (
            <p className="story-rail-state is-error" role="status">
              Story list unavailable.
            </p>
          )}
          {storiesState.status === "ready" &&
            (storiesState.data.stories.length === 0 ? (
              <p className="story-rail-state">No stories yet.</p>
            ) : (
              <ul className="story-rail-story-list">
                {storiesState.data.stories.map((story) => {
                  const isCurrent = story.id === storyId;
                  return (
                    <li key={story.id}>
                      <Link
                        to={`/stories/${encodeURIComponent(story.id)}`}
                        className={`story-rail-story${isCurrent ? " is-current" : ""}`}
                        aria-current={isCurrent ? "location" : undefined}
                        onClick={closeRail}
                      >
                        <span
                          className="story-rail-story-dot"
                          aria-hidden="true"
                        />
                        <span>{story.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}
        </nav>

        <footer className="story-rail-footer">
          <ThemeSwitcher />
        </footer>
      </aside>

      <div
        className="workspace-frame"
        aria-hidden={railOpen || undefined}
        inert={railOpen ? true : undefined}
      >
        <header className="workspace-header">
          <div className="workspace-header-leading">
            <button
              type="button"
              className="workspace-menu-toggle"
              aria-label="Open story navigation"
              aria-controls={railId}
              aria-expanded={railOpen}
              onClick={openRail}
            >
              <Icon name="menu" />
            </button>
            <div className="workspace-header-copy">
              <p className="workspace-header-eyebrow">{resolvedEyebrow}</p>
              <p className="workspace-header-title">{resolvedTitle}</p>
            </div>
          </div>
          {(mode || headerActions) && (
            <div className="workspace-header-actions">
              {mode && (
                <span className="workspace-mode" data-mode={mode}>
                  <span className="workspace-mode-dot" aria-hidden="true" />
                  {mode} mode
                </span>
              )}
              {headerActions}
            </div>
          )}
        </header>

        <div className="workspace-body">
          <main id="workspace-main" className="workspace-main" tabIndex={-1}>
            {children}
          </main>
          {dock && (
            <aside className="workspace-dock" aria-label="Workspace dock">
              {dock}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
