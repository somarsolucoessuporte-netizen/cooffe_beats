-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "conviteExpira" TIMESTAMP(3),
ADD COLUMN     "conviteToken" TEXT,
ALTER COLUMN "senha" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_conviteToken_key" ON "Usuario"("conviteToken");

