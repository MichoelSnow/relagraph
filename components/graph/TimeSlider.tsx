"use client"

import { useMemo } from "react"

import Button from "@/components/ui/Button"

const MS_PER_DAY = 24 * 60 * 60 * 1000

type TimeSliderProps = {
  asOf: string
  onChange: (asOf: string) => void
}

export default function TimeSlider({ asOf, onChange }: TimeSliderProps) {
  const startOfToday = useMemo(() => {
    const now = new Date()
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  }, [])

  const value = Math.round((Date.parse(asOf) - startOfToday) / MS_PER_DAY)

  return (
    <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-subpanel)] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="time-slider"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--console-text-muted)]"
        >
          Time
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="px-2.5 py-1"
          onClick={() => onChange(new Date().toISOString())}
        >
          Now
        </Button>
      </div>
      <input
        id="time-slider"
        type="range"
        min={-365}
        max={365}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          const nextAsOf = new Date(startOfToday + nextValue * MS_PER_DAY).toISOString()
          onChange(nextAsOf)
        }}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#24324d] accent-[var(--console-accent)]"
      />
      <p suppressHydrationWarning className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--console-text-muted)]">
        {new Date(asOf).toISOString()}
      </p>
    </div>
  )
}
