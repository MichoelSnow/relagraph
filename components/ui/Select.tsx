import type { SelectHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"
import { inputStyles } from "@/lib/ui/styles"

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export default function Select({ className, ...props }: SelectProps) {
  return <select className={cx(inputStyles(), className)} {...props} />
}
