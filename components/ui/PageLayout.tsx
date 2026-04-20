import type { HTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

type PageLayoutProps = HTMLAttributes<HTMLDivElement>

export default function PageLayout({ className, ...props }: PageLayoutProps) {
  return (
    <main
      className={cx("mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8", className)}
      {...props}
    />
  )
}
