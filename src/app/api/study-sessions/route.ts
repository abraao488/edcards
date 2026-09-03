import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let subjectId: string | null = null
    let topicId: string | null = null
    let minutes: number | null = null
    let name: string | null = null
    let startedAt: Date | null = null
    let endedAt: Date | null = null

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await request.json()
      subjectId = body.subjectId ?? null
      topicId = body.topicId ?? null
      minutes = body.minutes ?? null
      name = body.name ?? null
      startedAt = body.startedAt ? new Date(body.startedAt) : null
      endedAt = body.endedAt ? new Date(body.endedAt) : null
    } else {
      const form = await request.formData()
      subjectId = (form.get("subjectId") as string) || null
      topicId = (form.get("topicId") as string) || null
      const m = form.get("minutes")
      minutes = typeof m === "string" ? Number(m) : null
      name = (form.get("name") as string) || null
      const s = form.get("startedAt") as string | null
      const e = form.get("endedAt") as string | null
      startedAt = s ? new Date(s) : null
      endedAt = e ? new Date(e) : null
    }

    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "Invalid minutes" }, { status: 400 })
    }

    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email || "" },
      update: {},
    })

    const now = new Date()
    const finalEndedAt = endedAt ?? now
    const finalStartedAt =
      startedAt ?? new Date(finalEndedAt.getTime() - Math.round(minutes) * 60 * 1000)

    await prisma.studySession.create({
      data: {
        userId: user.id,
        name: name?.trim() || null,
        subjectId,
        topicId,
        durationMinutes: Math.round(minutes),
        startedAt: finalStartedAt,
        endedAt: finalEndedAt,
      },
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[Beacon] Error recording study session:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
