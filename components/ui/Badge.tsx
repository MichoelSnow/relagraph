import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "accent" | "success"
}

export default function Badge({ variant = "default", className, ...props }: BadgeProps) {
  const variantClass =
    variant === "accent"
      ? "inline-flex items-center rounded-full border border-[var(--console-badge-accent-border)] bg-[var(--console-badge-accent-bg)] px-2 py-0.5 text-xs text-[var(--console-badge-accent-text)]"
      : variant === "success"
        ? "inline-flex items-center rounded-full border border-[var(--console-badge-success-border)] bg-[var(--console-badge-success-bg)] px-2 py-0.5 text-xs text-[var(--console-badge-success-text)]"
        : "inline-flex items-center rounded-full border border-[var(--console-badge-default-border)] bg-[var(--console-badge-default-bg)] px-2 py-0.5 text-xs text-[var(--console-badge-default-text)]"

  return <span className={cx(variantClass, className)} {...props} />
}
