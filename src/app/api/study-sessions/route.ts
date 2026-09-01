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

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await request.json()
      subjectId = body.subjectId ?? null
      topicId = body.topicId ?? null
      minutes = body.minutes ?? null
    } else {
      const form = await request.formData()
      subjectId = (form.get("subjectId") as string) || null
      topicId = (form.get("topicId") as string) || null
      const m = form.get("minutes")
      minutes = typeof m === "string" ? Number(m) : null
    }

    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "Invalid minutes" }, { status: 400 })
    }

    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email || "" },
      update: {},
    })

    await prisma.studySession.create({
      data: {
        userId: user.id,
        subjectId,
        topicId,
        durationMinutes: Math.round(minutes),
      },
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[Beacon] Error recording study session:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
