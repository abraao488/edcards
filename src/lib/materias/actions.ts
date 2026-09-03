"use server"

import { prisma } from "@/lib/prisma"

export interface TopicWithFlashcardCount {
  id: string
  name: string
  _count: {
    flashcards: number
  }
}

export interface SubjectWithTopicsAndCounts {
  id: string
  name: string
  topics: TopicWithFlashcardCount[]
}

export async function getSubjectsWithTopicCounts(
  userId: string
): Promise<SubjectWithTopicsAndCounts[]> {
  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: {
      topics: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              flashcards: {
                where: {
                  deck: { userId },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    topics: subject.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      _count: topic._count,
    })),
  }))
}

export async function getTopicFlashcardsForQuiz(userId: string, topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { subject: true },
  })

  if (!topic) return null

  const flashcards = await prisma.flashcard.findMany({
    where: {
      topicId,
      deck: { userId },
    },
    include: {
      topic: {
        include: { subject: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return { topic, flashcards }
}
