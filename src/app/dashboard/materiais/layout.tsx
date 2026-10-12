import { requireActiveSubscriptionForPage } from "@/lib/subscription/guard"

export default async function MateriaisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireActiveSubscriptionForPage()

  return <>{children}</>
}
