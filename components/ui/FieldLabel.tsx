import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type FieldLabelProps = HTMLAttributes<HTMLSpanElement> & {
  compact?: boolean
}

export default function FieldLabel({ compact = false, className, ...props }: FieldLabelProps) {
  return (
    <span
      className={cx(
        compact
          ? "text-[11px] font-medium uppercase text-[var(--console-text-muted)]"
          : "text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]",
        className
      )}
      {...props}
    />
  )
}
