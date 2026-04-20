import { cx } from "./cx"

type ButtonVariant = "primary" | "ghost" | "danger"
type ButtonSize = "sm" | "md"

type CardVariant = "panel" | "subpanel" | "danger"

type BadgeVariant = "default" | "accent" | "success"

export function pageShellStyles(className?: string): string {
  return cx("min-h-screen bg-[var(--console-bg)]", className)
}

export function panelStyles(className?: string): string {
  return cx("mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 md:py-10", className)
}

export function cardStyles(variant: CardVariant = "panel", className?: string): string {
  const map: Record<CardVariant, string> = {
    panel:
      "rounded-xl border border-[var(--console-border)] bg-[var(--console-panel)] text-[var(--console-text)] shadow-sm",
    subpanel:
      "rounded-lg border border-[var(--console-border)] bg-[var(--console-subpanel)] text-[var(--console-text)]",
    danger:
      "rounded-lg border border-[var(--console-danger-border)] bg-[var(--console-danger-bg)] text-[var(--console-danger-text)] shadow-sm"
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
    "inline-flex items-center justify-center whitespace-nowrap rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--console-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--console-bg)]"
  const sizeClass = size === "sm" ? "px-3 py-1.5" : "px-4 py-2.5"
  const widthClass = block ? "w-full text-center" : "w-auto"
  const variantClass: Record<ButtonVariant, string> = {
    primary:
      "border-[var(--console-primary)] bg-[var(--console-primary)] text-white hover:bg-[var(--console-primary-hover)]",
    ghost:
      "border-[var(--console-border)] bg-white text-[var(--console-text)] hover:bg-[var(--console-subpanel)]",
    danger:
      "border-[var(--console-danger-border)] bg-[var(--console-danger-bg)] text-[var(--console-danger-text)] hover:bg-[#fef2f2]"
  }

  return cx(base, sizeClass, widthClass, variantClass[variant], options?.className)
}

export function inputStyles(className?: string): string {
  return cx(
    "mt-1.5 w-full rounded-md border border-[var(--console-border)] bg-white px-3 py-2 text-sm text-[var(--console-text)] placeholder:text-[var(--console-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--console-focus-ring)]",
    className
  )
}

export function badgeStyles(variant: BadgeVariant = "default", className?: string): string {
  const map: Record<BadgeVariant, string> = {
    default:
      "inline-flex items-center rounded-full border border-[var(--console-border)] bg-[var(--console-subpanel)] px-2 py-0.5 text-xs text-[var(--console-text-muted)]",
    accent:
      "inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-xs text-[#1e3a8a]",
    success:
      "inline-flex items-center rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-xs text-[#166534]"
  }

  return cx(map[variant], className)
}

export function sectionTitleStyles(className?: string): string {
  return cx("text-sm font-semibold tracking-tight text-[var(--console-text)]", className)
}

export const graphTheme = {
  node: {
    person: "#2563eb",
    animal: "#059669",
    place: "#d97706",
    text: "#1f2937",
    border: "#cbd5e1",
    textBg: "#ffffffd9",
    selectedBorder: "#1d4ed8",
    hoverOverlay: "#93c5fd"
  },
  edge: {
    text: "#475569",
    line: "#94a3b8",
    textBg: "#ffffffd9"
  },
  canvas: {
    border: "#dbe3ee",
    bgFrom: "#ffffff",
    bgTo: "#f8fafc"
  }
}
