import { describe, expect, it, vi } from 'vitest';
import { RankingService } from '../../src/services/ranking.service.js';
import { criarRepositorioAvaliacaoMock, jogador } from '../helpers.js';

describe('RankingService', () => {
  it('lista jogadores a partir da primeira avaliação', async () => {
    const avaliacoes = criarRepositorioAvaliacaoMock();
    const esperado = [{ ...jogador(), media: 5, totalAvaliacoes: 1 }];
    vi.mocked(avaliacoes.listarRanking).mockResolvedValue(esperado);

    await expect(new RankingService(avaliacoes).listar()).resolves.toEqual(esperado);
    expect(avaliacoes.listarRanking).toHaveBeenCalledOnce();
  });
});
