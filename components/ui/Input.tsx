import type { InputHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type InputProps = InputHTMLAttributes<HTMLInputElement>

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cx(
        "mt-1.5 w-full rounded-md border border-[var(--console-input-border)] bg-[var(--console-input-bg)] px-3 py-2 text-sm text-[var(--console-input-text)] placeholder:text-[var(--console-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--console-focus-ring)]",
        className
      )}
      {...props}
    />
  )
}
