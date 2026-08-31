import { requireActiveSubscriptionForPage } from "@/lib/subscription/guard"

export default async function QuestoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireActiveSubscriptionForPage()

  return <>{children}</>
}
