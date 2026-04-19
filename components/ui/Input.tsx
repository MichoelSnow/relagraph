import type { InputHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"
import { inputStyles } from "@/lib/ui/styles"

type InputProps = InputHTMLAttributes<HTMLInputElement>

export default function Input({ className, ...props }: InputProps) {
  return <input className={cx(inputStyles(), className)} {...props} />
}
