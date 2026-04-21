import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type FormContainerProps = HTMLAttributes<HTMLDivElement>

export default function FormContainer({ className, ...props }: FormContainerProps) {
  return <div className={cx("w-full max-w-[500px]", className)} {...props} />
}
