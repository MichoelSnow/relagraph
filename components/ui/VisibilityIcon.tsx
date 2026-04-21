type VisibilityIconProps = {
  hidden: boolean
}

export default function VisibilityIcon({ hidden }: VisibilityIconProps) {
  if (hidden) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
        <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 10 8 10 8a15.7 15.7 0 0 1-4.2 5.1" />
        <path d="M6.6 6.6A15.8 15.8 0 0 0 2 12s3 8 10 8a10.5 10.5 0 0 0 5.4-1.5" />
      </svg>
    )
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
