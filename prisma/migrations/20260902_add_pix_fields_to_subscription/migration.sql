-- AlterTable: Torna mercadopagoId nullable (para Pix que cria registro antes do pagamento)
ALTER TABLE "Subscription" ALTER COLUMN "mercadopagoId" DROP NOT NULL;

-- AlterTable: Adiciona accessExpiresAt para pagamento avulso (Pix)
ALTER TABLE "Subscription" ADD COLUMN "accessExpiresAt" TIMESTAMP(3);
