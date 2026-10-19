import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/recuperar-senha")
  const publicPaths = [
    "/",
    "/decks",
    "/robots.txt",
    "/sitemap.xml",
    "/termos",
    "/privacidade",
    "/reembolso",
    "/recuperar-senha",
    "/redefinir-senha",
    "/sentry-example-page",
  ]
  const isPublicPage =
    publicPaths.includes(path) || path.startsWith("/d/")

  // Atribuição de convite: guarda ?ref= em cookie para que o código sobreviva
  // à navegação até o /register (ex.: visitante chega pelo baralho público).
  const refParam = request.nextUrl.searchParams.get("ref")
  const refCookie = refParam?.replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || ""

  function withRefCookie(response: NextResponse) {
    if (refCookie) {
      response.cookies.set("ed_ref", refCookie, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      })
    }
    return response
  }

  if (!user && !isAuthPage && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return withRefCookie(NextResponse.redirect(url))
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return withRefCookie(NextResponse.redirect(url))
  }

  return withRefCookie(supabaseResponse)
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
