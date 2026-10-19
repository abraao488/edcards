import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { getSiteOrigin } from "@/lib/site"

// Revalida periodicamente: novos baralhos públicos entram no sitemap sem
// precisar de deploy.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getSiteOrigin()
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/decks`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${origin}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/reembolso`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  try {
    const decks = await prisma.deck.findMany({
      where: { isPublic: true, shareSlug: { not: null } },
      select: { shareSlug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 5000,
    })

    return [
      ...staticRoutes,
      ...decks
        .filter((d): d is { shareSlug: string; updatedAt: Date } => d.shareSlug !== null)
        .map((d) => ({
          url: `${origin}/d/${d.shareSlug}`,
          lastModified: d.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        })),
    ]
  } catch (err) {
    // Sitemap é best-effort: nunca deve derrubar a rota.
    console.error("[sitemap] falha ao carregar baralhos públicos:", err)
    return staticRoutes
  }
}
