import { describe, expect, it, vi } from 'vitest';
import { SorteioService } from '../../src/services/sorteio.service.js';
import { criarRepositorioSessaoMock, jogador } from '../helpers.js';

describe('SorteioService', () => {
  it('distribui jogadores em snake draft e persiste os times', async () => {
    const sessoes = criarRepositorioSessaoMock();
    vi.mocked(sessoes.obterOuCriarAberta).mockResolvedValue({ id: 'sessao-1', participantes: [] });
    vi.mocked(sessoes.listarParticipantesAvaliados).mockResolvedValue(
      [5, 4, 3, 2, 1, 1].map((media, indice) => ({
        ...jogador(String(indice), `Jogador ${indice}`, `${indice}@s.whatsapp.net`),
        media,
        totalAvaliacoes: 3,
      })),
    );

    const times = await new SorteioService(sessoes).sortear(2);

    expect(times[0]?.jogadores.map(({ media }) => media)).toEqual([5, 2, 1]);
    expect(times[1]?.jogadores.map(({ media }) => media)).toEqual([4, 3, 1]);
    expect(Math.abs((times[0]?.pontuacao ?? 0) - (times[1]?.pontuacao ?? 0))).toBeLessThanOrEqual(
      5,
    );
    expect(sessoes.substituirTimes).toHaveBeenCalledWith('sessao-1', times);
  });

  it('recusa menos de dois times', async () => {
    await expect(new SorteioService(criarRepositorioSessaoMock()).sortear(1)).rejects.toThrow(
      'maior ou igual a 2',
    );
  });
});
