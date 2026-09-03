-- AlterTable: Adiciona campos de histórico à StudySession
ALTER TABLE "StudySession" ADD COLUMN "name" TEXT;
ALTER TABLE "StudySession" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "StudySession" ADD COLUMN "endedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");
