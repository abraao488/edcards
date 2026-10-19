import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
  display: "swap",
})

function resolveMetadataBase(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!raw) return undefined
  try {
    return new URL(raw)
  } catch {
    return undefined
  }
}

const siteDescription =
  "Flashcards com IA e repetição espaçada para concursos públicos. Estude menos, memorize mais."

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "Edcards — Flashcards com IA para concursos",
    template: "%s | Edcards",
  },
  description: siteDescription,
  applicationName: "Edcards",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Edcards",
    title: "Edcards — Flashcards com IA para concursos",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Edcards — Flashcards com IA para concursos",
    description: siteDescription,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
