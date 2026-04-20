import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"
import { sectionTitleStyles } from "@/lib/ui/styles"

type SectionHeaderProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4"
}

export default function SectionHeader({ as = "h2", className, ...props }: SectionHeaderProps) {
  const Component = as
  return <Component className={cx(sectionTitleStyles(), className)} {...props} />
}
