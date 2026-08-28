CREATE TYPE "StatusSessao" AS ENUM ('ABERTA', 'FECHADA');

CREATE TABLE "Player" (
  "id" TEXT NOT NULL,
  "jid" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sessao" (
  "id" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "StatusSessao" NOT NULL DEFAULT 'ABERTA',
  "chaveAberta" TEXT DEFAULT 'ATIVA',
  CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListaParticipante" (
  "id" TEXT NOT NULL,
  "sessaoId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "confirmadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListaParticipante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VotacaoAtiva" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "grupoJid" TEXT NOT NULL,
  "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "fechada" BOOLEAN NOT NULL DEFAULT false,
  "pollMessageId" TEXT,
  "pollMessageSecret" TEXT,
  CONSTRAINT "VotacaoAtiva_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Avaliacao" (
  "id" TEXT NOT NULL,
  "avaliadorId" TEXT NOT NULL,
  "avaliadoId" TEXT NOT NULL,
  "votacaoId" TEXT NOT NULL,
  "estrelas" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Avaliacao_estrelas_check" CHECK ("estrelas" BETWEEN 1 AND 5)
);

CREATE TABLE "Time" (
  "id" TEXT NOT NULL,
  "sessaoId" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "jogadores" TEXT[],
  CONSTRAINT "Time_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Player_jid_key" ON "Player"("jid");
CREATE UNIQUE INDEX "Sessao_chaveAberta_key" ON "Sessao"("chaveAberta");
CREATE UNIQUE INDEX "ListaParticipante_sessaoId_playerId_key" ON "ListaParticipante"("sessaoId", "playerId");
CREATE UNIQUE INDEX "VotacaoAtiva_pollMessageId_key" ON "VotacaoAtiva"("pollMessageId");
CREATE INDEX "VotacaoAtiva_grupoJid_fechada_expiraEm_idx" ON "VotacaoAtiva"("grupoJid", "fechada", "expiraEm");
CREATE UNIQUE INDEX "Avaliacao_votacaoId_avaliadorId_key" ON "Avaliacao"("votacaoId", "avaliadorId");
CREATE INDEX "Avaliacao_avaliadoId_idx" ON "Avaliacao"("avaliadoId");
CREATE UNIQUE INDEX "Time_sessaoId_numero_key" ON "Time"("sessaoId", "numero");

ALTER TABLE "ListaParticipante" ADD CONSTRAINT "ListaParticipante_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListaParticipante" ADD CONSTRAINT "ListaParticipante_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VotacaoAtiva" ADD CONSTRAINT "VotacaoAtiva_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_avaliadorId_fkey" FOREIGN KEY ("avaliadorId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_avaliadoId_fkey" FOREIGN KEY ("avaliadoId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_votacaoId_fkey" FOREIGN KEY ("votacaoId") REFERENCES "VotacaoAtiva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Time" ADD CONSTRAINT "Time_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
