import { describe, expect, it, vi } from 'vitest';
import type { RepositorioEstatisticas } from '../../src/repositories/estatisticas.repository.js';
import { EstatisticasService } from '../../src/services/estatisticas.service.js';
import { criarRepositorioJogadorMock, jogador } from '../helpers.js';

describe('EstatisticasService', () => {
  it('retorna apenas presenças, rating e sequência do próprio jogador', async () => {
    const jogadores = criarRepositorioJogadorMock();
    const jogadorEncontrado = jogador();
    vi.mocked(jogadores.buscarPorJid).mockResolvedValue(jogadorEncontrado);
    const repositorio = {
      obterDoJogador: vi.fn().mockResolvedValue({
        jogador: jogadorEncontrado,
        peladasPresentes: 12,
        rating: 4.5,
        totalAvaliacoes: 8,
        sequenciaAtual: 3,
      }),
    } as unknown as RepositorioEstatisticas;

    await expect(
      new EstatisticasService(jogadores, repositorio).obter('5511@s.whatsapp.net', ''),
    ).resolves.toMatchObject({
      tipo: 'encontrado',
      estatisticas: { peladasPresentes: 12, rating: 4.5, sequenciaAtual: 3 },
    });
  });
});
