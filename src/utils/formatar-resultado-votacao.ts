import type { ResultadoVotacao } from '../models/types.js';

export const formatarResultadoVotacao = (resultado: ResultadoVotacao): string =>
  resultado.totalVotos
    ? `📊 Votação encerrada: ${resultado.jogador.nome} recebeu média ${resultado.media?.toFixed(1)} ⭐ em ${resultado.totalVotos} voto(s).`
    : `📊 Votação encerrada: ${resultado.jogador.nome} não recebeu votos.`;
