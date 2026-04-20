import type { ButtonHTMLAttributes } from "react"

import { cx } from "@/lib/ui/cx"

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
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2"
  const sizeClass = size === "sm" ? "px-3 py-1.5" : "px-4 py-2.5"
  const widthClass = block ? "w-full text-center" : "w-auto"
  const variantClass =
    variant === "primary"
      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : variant === "danger"
        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"

  return (
    <button
      className={cx(base, sizeClass, widthClass, variantClass, className)}
      {...props}
    />
  )
}
