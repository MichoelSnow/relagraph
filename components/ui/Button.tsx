import type { ButtonHTMLAttributes } from "react"

import { buttonStyles } from "@/lib/ui/styles"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger"
  size?: "sm" | "md"
  block?: boolean
}

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonStyles({
        variant,
        size,
        block,
        className
      })}
      {...props}
    />
  )
}
