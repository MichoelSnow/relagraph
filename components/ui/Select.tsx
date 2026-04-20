import type { SelectHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export default function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cx(
        "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        className
      )}
      {...props}
    />
  )
}
