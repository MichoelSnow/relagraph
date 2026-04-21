import type { HTMLAttributes, ReactNode } from "react"

import { cx } from "@/lib/ui/cx"

type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode
}

export default function Section({ title, className, children, ...props }: SectionProps) {
  return (
    <section className={cx("mb-6 rounded-lg border border-[var(--console-border)] bg-[var(--console-panel)] p-4", className)} {...props}>
      {title ? <h2 className="mb-3 text-sm font-semibold text-[var(--console-text-strong)]">{title}</h2> : null}
      <div className="space-y-4">{children}</div>
    </section>
  )
}
