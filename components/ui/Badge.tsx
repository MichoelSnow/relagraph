import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "accent" | "success"
}

export default function Badge({ variant = "default", className, ...props }: BadgeProps) {
  const variantClass =
    variant === "accent"
      ? "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-900"
      : variant === "success"
        ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
        : "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"

  return <span className={cx(variantClass, className)} {...props} />
}
