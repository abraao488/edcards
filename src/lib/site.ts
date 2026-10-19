import { headers } from "next/headers"

/**
 * Origem pública do app, base dos links compartilháveis (convite, baralhos
 * públicos) e dos canonical/OG das páginas indexáveis.
 *
 * Prioriza NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL. Quando configuradas, a
 * função nem toca em headers() — o que mantém páginas públicas cacheáveis.
 * Sem configuração, deriva dos headers da request (Vercel envia
 * x-forwarded-host), o que é suficiente para dev e previews.
 */
export async function getSiteOrigin(): Promise<string> {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/+$/, "")
  if (configured) return configured

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}
