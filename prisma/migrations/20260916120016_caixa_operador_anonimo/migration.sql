-- DropForeignKey
ALTER TABLE "caixas" DROP CONSTRAINT "caixas_usuarioId_fkey";

-- AlterTable
ALTER TABLE "caixas" ADD COLUMN     "operadorNome" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "caixas" ADD CONSTRAINT "caixas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
