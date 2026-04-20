import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"
import { badgeStyles } from "@/lib/ui/styles"

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "accent" | "success"
}

export default function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return <span className={cx(badgeStyles(variant), className)} {...props} />
}
