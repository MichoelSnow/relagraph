import { cx } from "./cx"

type ButtonVariant = "primary" | "ghost" | "danger"
type ButtonSize = "sm" | "md"

type CardVariant = "panel" | "subpanel" | "danger"

type BadgeVariant = "default" | "accent" | "success"

export function pageShellStyles(className?: string): string {
  return cx("relative min-h-screen overflow-hidden bg-[var(--console-bg)]", className)
}

export function panelStyles(className?: string): string {
  return cx("relative z-10 mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-10", className)
}

export function cardStyles(variant: CardVariant = "panel", className?: string): string {
  const map: Record<CardVariant, string> = {
    panel:
      "rounded-2xl border border-[var(--console-border)] bg-[var(--console-panel)] text-[var(--console-text)] shadow-[var(--console-shadow)]",
    subpanel:
      "rounded-xl border border-[var(--console-border)] bg-[var(--console-subpanel)] text-[var(--console-text)]",
    danger:
      "rounded-lg border border-[var(--console-danger-border)] bg-[var(--console-danger-bg)] text-[var(--console-danger-text)]"
  }

  return cx(map[variant], className)
}

export function buttonStyles(options?: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
}): string {
  const variant = options?.variant ?? "primary"
  const size = options?.size ?? "md"
  const block = options?.block ?? false

  const base =
    "rounded-lg border font-mono text-xs uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50"
  const sizeClass = size === "sm" ? "px-3 py-1.5" : "px-4 py-2.5"
  const widthClass = block ? "w-full text-center" : "w-auto"
  const variantClass: Record<ButtonVariant, string> = {
    primary:
      "border-[var(--console-accent)] bg-[var(--console-accent-soft)] text-[#6fe8ff] hover:bg-[var(--console-accent-soft-hover)]",
    ghost:
      "border-[var(--console-border)] bg-[var(--console-panel-muted)] text-[var(--console-text)] hover:border-[var(--console-accent)] hover:text-[#6fe8ff]",
    danger:
      "border-[var(--console-danger-border)] bg-[var(--console-danger-bg)] text-[var(--console-danger-text)] hover:brightness-110"
  }

  return cx(base, sizeClass, widthClass, variantClass[variant], options?.className)
}

export function inputStyles(className?: string): string {
  return cx(
    "mt-1.5 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-panel-muted)] px-3 py-2.5 text-sm text-[#e7eeff] placeholder:text-[#6f7f9f] focus:console-focus",
    className
  )
}

export function badgeStyles(variant: BadgeVariant = "default", className?: string): string {
  const map: Record<BadgeVariant, string> = {
    default:
      "rounded border border-[var(--console-border)] bg-[var(--console-panel-muted)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--console-text-muted)]",
    accent:
      "rounded border border-[var(--console-accent)] bg-[#08222b] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#6fe8ff]",
    success:
      "rounded border border-[var(--console-border)] bg-[var(--console-panel-muted)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--console-success)]"
  }

  return cx(map[variant], className)
}

export function sectionTitleStyles(className?: string): string {
  return cx("font-mono text-xs uppercase tracking-[0.16em] text-[var(--console-text-muted)]", className)
}

export const graphTheme = {
  node: {
    person: "#00f3ff",
    animal: "#15ff83",
    place: "#ffb14a",
    text: "#d7deef",
    border: "#0b1120",
    textBg: "#0f1524d9",
    selectedBorder: "#ff4fd8",
    hoverOverlay: "#00f3ff"
  },
  edge: {
    text: "#8ea1c6",
    line: "#4a5d81",
    textBg: "#0f1524d9"
  },
  canvas: {
    border: "#2a3347",
    bgFrom: "#0a1222",
    bgTo: "#0e1a30"
  }
}
