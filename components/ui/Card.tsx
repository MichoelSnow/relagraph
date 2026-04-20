import type { ComponentPropsWithoutRef, ElementType } from "react"

import { cx } from "@/lib/ui/cx"
import { cardStyles } from "@/lib/ui/styles"

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
  return <Component className={cx(cardStyles(variant), className)} {...props} />
}
