import type { MetadataRoute } from "next"
import { getSiteOrigin } from "@/lib/site"

export const dynamic = "force-dynamic"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getSiteOrigin()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Áreas autenticadas e endpoints internos não devem ser indexados.
        disallow: [
          "/api/",
          "/dashboard/",
          "/bem-vindo",
          "/cadastrar",
          "/organizar",
          "/gerenciador",
          "/edital",
          "/materias",
          "/flashcards",
          "/criar-com-edcards",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  }
}
