import type { HTMLAttributes, ReactNode } from "react"

import { cx } from "@/lib/ui/cx"

type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode
}

export default function Section({ title, className, children, ...props }: SectionProps) {
  return (
    <section className={cx("mb-6 rounded-lg border p-4", className)} {...props}>
      {title ? <h2 className="mb-3 text-sm font-semibold">{title}</h2> : null}
      <div className="space-y-4">{children}</div>
    </section>
  )
}
