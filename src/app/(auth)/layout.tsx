import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Revisaí - Login",
  description: "Acesse sua conta Revisaí",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {children}
    </div>
  )
}
