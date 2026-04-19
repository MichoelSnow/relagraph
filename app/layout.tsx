import type { Metadata } from "next"
import Providers from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "Relagraph",
  description: "Temporal relationship graph explorer"
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="app-shell antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
