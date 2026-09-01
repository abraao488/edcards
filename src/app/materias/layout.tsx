import { requireActiveSubscriptionForPage } from "@/lib/subscription/guard"

export default async function MateriasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireActiveSubscriptionForPage()

  return <>{children}</>
}
