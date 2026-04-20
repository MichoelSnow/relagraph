import type { SelectHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export default function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cx(
        "mt-1.5 w-full rounded-md border border-[var(--console-input-border)] bg-[var(--console-input-bg)] px-3 py-2 text-sm text-[var(--console-input-text)] focus:outline-none focus:ring-2 focus:ring-[var(--console-focus-ring)]",
        className
      )}
      {...props}
    />
  )
}
