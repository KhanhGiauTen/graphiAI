import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Graphify AI",
  description: "AI-assisted tabular-to-graph modeling platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
