import type { Comando } from '../models/types.js';
import type { RankingService } from '../services/ranking.service.js';

export class RankingCommand implements Comando {
  public readonly nome = 'ranking';
  public readonly descricao = 'mostra o ranking dos jogadores avaliados';

  public constructor(private readonly rankingService: RankingService) {}

  public async executar(): Promise<string> {
    const ranking = await this.rankingService.listar();
    if (!ranking.length) return '🏆 Ainda não há jogadores avaliados.';
    const posicoes = ranking
      .map(
        ({ nome, media, totalAvaliacoes }, indice) =>
          `${indice + 1}. ${nome} ⭐ ${media.toFixed(1)} (${totalAvaliacoes} avaliações)`,
      )
      .join('\n');
    return `🏆 Ranking da pelada:\n${posicoes}`;
  }
}
