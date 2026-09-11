import { describe, expect, it, vi } from 'vitest';
import { PublicadorVotacoesExpiradas } from '../../src/services/publicador-votacoes-expiradas.js';
import type { VotacaoService } from '../../src/services/votacao.service.js';
import { criarClienteEvolutionMock, jogador, votacao } from '../helpers.js';

describe('PublicadorVotacoesExpiradas', () => {
  it('publica o resultado de todas as votações encerradas', async () => {
    const primeira = votacao();
    const segunda = {
      ...votacao(),
      id: 'votacao-2',
      jogador: jogador('jogador-2', 'Maria', '5522@s.whatsapp.net'),
    };
    const votacaoService = {
      fecharExpiradas: vi.fn().mockResolvedValue([
        {
          votacao: primeira,
          resultado: { jogador: primeira.jogador, media: 4.5, totalVotos: 2 },
        },
        {
          votacao: segunda,
          resultado: { jogador: segunda.jogador, media: 5, totalVotos: 1 },
        },
      ]),
    } as unknown as VotacaoService;
    const evolution = criarClienteEvolutionMock();

    await new PublicadorVotacoesExpiradas(votacaoService, evolution).publicar();

    expect(evolution.enviarTexto).toHaveBeenCalledTimes(2);
    expect(evolution.enviarTexto).toHaveBeenNthCalledWith(
      1,
      'grupo@g.us',
      expect.stringContaining('João'),
    );
    expect(evolution.enviarTexto).toHaveBeenNthCalledWith(
      2,
      'grupo@g.us',
      expect.stringContaining('Maria'),
    );
  });
});
