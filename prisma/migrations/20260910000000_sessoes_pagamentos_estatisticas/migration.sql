ALTER TABLE "Sessao"
ADD COLUMN "valorTotalCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "encerradaEm" TIMESTAMP(3);

ALTER TABLE "Sessao"
ALTER COLUMN "data" DROP DEFAULT;

ALTER TABLE "ListaParticipante"
ADD COLUMN "canceladoEm" TIMESTAMP(3),
ADD COLUMN "presente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pagoEm" TIMESTAMP(3),
ADD COLUMN "valorPagoCentavos" INTEGER;

ALTER TABLE "VotacaoAtiva"
ADD COLUMN "sessaoId" TEXT;

CREATE TABLE "ResumoMensalPublicado" (
  "competencia" TEXT NOT NULL,
  "publicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumoMensalPublicado_pkey" PRIMARY KEY ("competencia")
);

ALTER TABLE "VotacaoAtiva"
ADD CONSTRAINT "VotacaoAtiva_sessaoId_fkey"
FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
