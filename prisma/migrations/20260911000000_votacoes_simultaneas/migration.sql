CREATE UNIQUE INDEX "VotacaoAtiva_sessaoId_playerId_ativa_key"
ON "VotacaoAtiva"("sessaoId", "playerId")
WHERE "fechada" = false;
