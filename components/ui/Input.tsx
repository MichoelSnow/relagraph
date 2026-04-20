import type { InputHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type InputProps = InputHTMLAttributes<HTMLInputElement>

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cx(
        "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        className
      )}
      {...props}
    />
  )
}
