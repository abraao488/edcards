-- AlterTable: Adiciona coluna userId (nullable temporariamente)
ALTER TABLE "Subject" ADD COLUMN "userId" TEXT;

-- Migração de dados: atribui todas as matérias existentes ao usuário abraaoeberg@gmail.com
UPDATE "Subject" SET "userId" = (
  SELECT id FROM "User" WHERE email = 'abraaoeberg@gmail.com' LIMIT 1
);

-- Torna a coluna NOT NULL após a migração dos dados
ALTER TABLE "Subject" ALTER COLUMN "userId" SET NOT NULL;

-- Adiciona a foreign key
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona índice para consultas por userId
CREATE INDEX "Subject_userId_idx" ON "Subject"("userId");
