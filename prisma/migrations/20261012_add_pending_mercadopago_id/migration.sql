-- AlterTable: Guarda a referência de um preapproval de cartão criado enquanto
-- o Pix continuava ativo, sem sobrescrever mercadopagoId (que aponta para o
-- pagamento Pix que liberou o acesso).
ALTER TABLE "Subscription" ADD COLUMN "pendingMercadopagoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_pendingMercadopagoId_key" ON "Subscription"("pendingMercadopagoId");
