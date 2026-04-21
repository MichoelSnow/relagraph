import type { ComponentPropsWithoutRef, ElementType } from "react"

import { cx } from "@/lib/ui/cx"

type CardTag = "section" | "article" | "aside" | "header" | "div" | "form"

type CardProps<T extends ElementType> = {
  as?: T
  variant?: "panel" | "subpanel" | "danger"
} & Omit<ComponentPropsWithoutRef<T>, "as">

export default function Card<T extends CardTag = "section">({
  as,
  variant = "panel",
  className,
  ...props
}: CardProps<T>) {
  const Component = (as ?? "section") as ElementType
  const variantClass =
    variant === "danger"
      ? "rounded-lg border border-[var(--console-danger-border)] bg-[var(--console-danger-bg)] text-[var(--console-danger-text)] shadow-sm"
      : variant === "subpanel"
        ? "rounded-lg border border-[var(--console-border)] bg-[var(--console-subpanel)] text-[var(--console-text-dim)]"
        : "rounded-xl border border-[var(--console-border)] bg-[var(--console-panel)] text-[var(--console-text)] shadow-sm"

  return <Component className={cx(variantClass, className)} {...props} />
}
