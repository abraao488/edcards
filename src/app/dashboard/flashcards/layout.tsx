import { requireActiveSubscriptionForPage } from "@/lib/subscription/guard"

export default async function FlashcardsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireActiveSubscriptionForPage()

  return <>{children}</>
}
