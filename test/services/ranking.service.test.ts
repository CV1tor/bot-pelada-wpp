import { describe, expect, it, vi } from 'vitest';
import { RankingService } from '../../src/services/ranking.service.js';
import { criarRepositorioAvaliacaoMock, jogador } from '../helpers.js';

describe('RankingService', () => {
  it('solicita apenas jogadores com no mínimo três avaliações', async () => {
    const avaliacoes = criarRepositorioAvaliacaoMock();
    const esperado = [{ ...jogador(), media: 4.5, totalAvaliacoes: 4 }];
    vi.mocked(avaliacoes.listarRanking).mockResolvedValue(esperado);

    await expect(new RankingService(avaliacoes).listar()).resolves.toEqual(esperado);
    expect(avaliacoes.listarRanking).toHaveBeenCalledWith(3);
  });
});
