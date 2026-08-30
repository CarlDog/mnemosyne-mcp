import type { SVGProps } from "react";

export type IconName =
  | "archive"
  | "arrow-left"
  | "chevron-right"
  | "close"
  | "image"
  | "library"
  | "menu"
  | "panel"
  | "play"
  | "plus"
  | "quill"
  | "search"
  | "send"
  | "spark"
  | "users";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  /**
   * Supply a label only when the icon conveys meaning by itself. Icons next
   * to visible text remain decorative and are hidden from assistive tech.
   */
  label?: string;
  size?: number | string;
}

function IconGlyph({ name }: { name: IconName }) {
  switch (name) {
    case "archive":
      return (
        <>
          <path d="M4 7.5h16v12H4z" />
          <path d="M3 4.5h18v3H3zM9 11h6" />
        </>
      );
    case "arrow-left":
      return <path d="m11 5-7 7 7 7M4 12h16" />;
    case "chevron-right":
      return <path d="m9 6 6 6-6 6" />;
    case "close":
      return <path d="m6 6 12 12M18 6 6 18" />;
    case "image":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m4 17 4.5-4.5 3.5 3 2.5-2.5 5.5 5" />
        </>
      );
    case "library":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      );
    case "menu":
      return <path d="M4 7h16M4 12h16M4 17h16" />;
    case "panel":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
        </>
      );
    case "play":
      return <path d="m9 7 8 5-8 5z" />;
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "quill":
      return (
        <>
          <path d="M20 4c-6.5.2-11.5 4-13.5 10.5L5 20l5.5-1.5C17 16.5 20.8 11.5 21 5z" />
          <path d="M6.5 17.5 15 9M10 14l4 .5M13 10.5l.5-4" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      );
    case "send":
      return (
        <>
          <path d="m3.5 5 17 7-17 7 3-7z" />
          <path d="M6.5 12h14" />
        </>
      );
    case "spark":
      return (
        <>
          <path d="M12 2.5c.6 4 2.8 6.2 6.8 6.8-4 .6-6.2 2.8-6.8 6.8-.6-4-2.8-6.2-6.8-6.8 4-.6 6.2-2.8 6.8-6.8Z" />
          <path d="M19 16.5c.2 1.4 1.1 2.3 2.5 2.5-1.4.2-2.3 1.1-2.5 2.5-.2-1.4-1.1-2.3-2.5-2.5 1.4-.2 2.3-1.1 2.5-2.5Z" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" />
          <path d="M15 6.5a2.5 2.5 0 0 1 0 4.9M16 13c2.7.3 4.2 2.3 4.5 5" />
        </>
      );
  }
}

/** A small, dependency-free outline icon for interface chrome. */
export default function Icon({
  name,
  label,
  size = 20,
  className,
  ...svgProps
}: IconProps) {
  const accessibleName = label ?? svgProps["aria-label"];
  const classes = className ? `icon ${className}` : "icon";

  return (
    <svg
      {...svgProps}
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={accessibleName ? "img" : undefined}
      aria-label={accessibleName}
      aria-hidden={accessibleName ? undefined : true}
      focusable="false"
    >
      <IconGlyph name={name} />
    </svg>
  );
}
