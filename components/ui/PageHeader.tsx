import type { ReactNode } from "react"

import { cx } from "@/lib/ui/cx"

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cx("mb-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  )
}
