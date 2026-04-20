import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type StackProps = HTMLAttributes<HTMLDivElement>

export default function Stack({ className, ...props }: StackProps) {
  return <div className={cx("flex flex-col gap-4", className)} {...props} />
}
