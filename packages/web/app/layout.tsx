import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "SmartScraper Dashboard",
  description: "AI-powered generic e-commerce scraper",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
