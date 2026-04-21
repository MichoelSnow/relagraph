export const graphTheme = {
  node: {
    person: "var(--graph-node-person)",
    animal: "var(--graph-node-animal)",
    place: "var(--graph-node-place)",
    text: "var(--graph-node-text)",
    border: "var(--graph-node-border)",
    textBg: "var(--graph-node-text-bg)",
    selectedBorder: "var(--graph-node-selected-border)",
    hoverOverlay: "var(--graph-node-hover-overlay)"
  },
  edge: {
    text: "var(--graph-edge-text)",
    line: "var(--graph-edge-line)",
    textBg: "var(--graph-edge-text-bg)"
  },
  canvas: {
    border: "var(--graph-canvas-border)",
    bgFrom: "var(--graph-canvas-bg-from)",
    bgTo: "var(--graph-canvas-bg-to)"
  }
}

export type ResolvedGraphTheme = {
  node: {
    person: string
    animal: string
    place: string
    text: string
    border: string
    textBg: string
    selectedBorder: string
    hoverOverlay: string
  }
  edge: {
    text: string
    line: string
    textBg: string
  }
  canvas: {
    border: string
    bgFrom: string
    bgTo: string
  }
}

export function resolveGraphTheme(element?: HTMLElement | null): ResolvedGraphTheme {
  const root = element?.ownerDocument?.documentElement ?? document.documentElement
  const styles = window.getComputedStyle(root)
  const normalizeColor = (value: string): string => {
    const hex8Match = value.match(/^#([0-9a-fA-F]{8})$/)
    if (hex8Match) {
      const hex = hex8Match[1]
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = Number.parseInt(hex.slice(6, 8), 16) / 255
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`
    }

    const hex4Match = value.match(/^#([0-9a-fA-F]{4})$/)
    if (hex4Match) {
      const hex = hex4Match[1]
      const r = Number.parseInt(hex[0] + hex[0], 16)
      const g = Number.parseInt(hex[1] + hex[1], 16)
      const b = Number.parseInt(hex[2] + hex[2], 16)
      const a = Number.parseInt(hex[3] + hex[3], 16) / 255
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`
    }

    return value
  }

  const color = (name: string) => normalizeColor(styles.getPropertyValue(name).trim())

  return {
    node: {
      person: color("--graph-node-person"),
      animal: color("--graph-node-animal"),
      place: color("--graph-node-place"),
      text: color("--graph-node-text"),
      border: color("--graph-node-border"),
      textBg: color("--graph-node-text-bg"),
      selectedBorder: color("--graph-node-selected-border"),
      hoverOverlay: color("--graph-node-hover-overlay")
    },
    edge: {
      text: color("--graph-edge-text"),
      line: color("--graph-edge-line"),
      textBg: color("--graph-edge-text-bg")
    },
    canvas: {
      border: color("--graph-canvas-border"),
      bgFrom: color("--graph-canvas-bg-from"),
      bgTo: color("--graph-canvas-bg-to")
    }
  }
}
