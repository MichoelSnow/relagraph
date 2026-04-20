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
      ? "rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm"
      : variant === "subpanel"
        ? "rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
        : "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm"

  return <Component className={cx(variantClass, className)} {...props} />
}
