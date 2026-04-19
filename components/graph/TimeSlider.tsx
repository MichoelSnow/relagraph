"use client"

import { useMemo } from "react"

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
    <section className="rounded-md border border-slate-300 bg-white p-3">
      <div className="flex items-center justify-between">
        <label htmlFor="time-slider" className="text-sm font-medium text-slate-700">
          Time
        </label>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
          onClick={() => onChange(new Date().toISOString())}
        >
          Now
        </button>
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
        className="mt-3 w-full"
      />
      <p className="mt-2 text-xs text-slate-600">{new Date(asOf).toISOString()}</p>
    </section>
  )
}
