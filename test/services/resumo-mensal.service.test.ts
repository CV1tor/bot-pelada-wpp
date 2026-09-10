import { describe, expect, it, vi } from 'vitest';
import type { RepositorioEstatisticas } from '../../src/repositories/estatisticas.repository.js';
import { ResumoMensalService } from '../../src/services/resumo-mensal.service.js';
import { criarClienteEvolutionMock, jogador } from '../helpers.js';

describe('ResumoMensalService', () => {
  it('publica uma única vez a quantidade de peladas e o maior rating do mês anterior', async () => {
    const evolution = criarClienteEvolutionMock();
    const repositorio = {
      possuiVotacaoEmAndamento: vi.fn().mockResolvedValue(false),
      reservarPublicacaoMensal: vi.fn().mockResolvedValue(true),
      obterResumoMensal: vi.fn().mockResolvedValue({
        competencia: '2026-08',
        quantidadePeladas: 4,
        destaque: { ...jogador(), media: 4.8, totalAvaliacoes: 12 },
      }),
      liberarPublicacaoMensal: vi.fn(),
    } as unknown as RepositorioEstatisticas;
    const servico = new ResumoMensalService(
      repositorio,
      evolution,
      'grupo@g.us',
      () => new Date('2026-09-10T12:00:00.000Z'),
    );

    await expect(servico.publicarMesAnterior()).resolves.toBe(true);
    expect(evolution.enviarTexto).toHaveBeenCalledWith(
      'grupo@g.us',
      expect.stringContaining('Peladas realizadas: 4'),
    );
    expect(evolution.enviarTexto).toHaveBeenCalledWith(
      'grupo@g.us',
      expect.stringContaining('João — 4.8'),
    );
  });

  it('aguarda o encerramento das votações do mês', async () => {
    const evolution = criarClienteEvolutionMock();
    const repositorio = {
      possuiVotacaoEmAndamento: vi.fn().mockResolvedValue(true),
      reservarPublicacaoMensal: vi.fn(),
    } as unknown as RepositorioEstatisticas;
    const servico = new ResumoMensalService(
      repositorio,
      evolution,
      'grupo@g.us',
      () => new Date('2026-09-10T12:00:00.000Z'),
    );

    await expect(servico.publicarMesAnterior()).resolves.toBe(false);
    expect(evolution.enviarTexto).not.toHaveBeenCalled();
  });
});
