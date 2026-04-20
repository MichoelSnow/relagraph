import type { ButtonHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger"
  size?: "sm" | "md"
  block?: boolean
}

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--console-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--console-bg)]"
  const sizeClass = size === "sm" ? "px-3 py-1.5" : "px-4 py-2.5"
  const widthClass = block ? "w-full text-center" : "w-auto"
  const variantClass =
    variant === "primary"
      ? "border-[var(--console-primary)] bg-[var(--console-primary)] text-[var(--console-bg)] hover:bg-[var(--console-primary-hover)]"
      : variant === "danger"
        ? "border-[var(--console-danger-border)] bg-[var(--console-danger-bg)] text-[var(--console-danger-text)] hover:bg-[var(--console-danger-bg-hover)]"
        : "border-[var(--console-border)] bg-[var(--console-panel)] text-[var(--console-text)] hover:bg-[var(--console-panel-muted)]"

  return (
    <button
      className={cx(base, sizeClass, widthClass, variantClass, className)}
      {...props}
    />
  )
}
