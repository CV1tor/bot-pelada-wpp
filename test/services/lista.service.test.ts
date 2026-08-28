import { describe, expect, it, vi } from 'vitest';
import { ListaService } from '../../src/services/lista.service.js';
import { criarRepositorioJogadorMock, criarRepositorioSessaoMock, jogador } from '../helpers.js';

describe('ListaService', () => {
  it('salva o jogador e o adiciona à sessão aberta', async () => {
    const jogadores = criarRepositorioJogadorMock();
    const sessoes = criarRepositorioSessaoMock();
    vi.mocked(jogadores.salvar).mockResolvedValue(jogador());
    vi.mocked(sessoes.obterOuCriarAberta).mockResolvedValue({ id: 'sessao-1', participantes: [] });
    vi.mocked(sessoes.adicionarParticipante).mockResolvedValue(true);

    const resultado = await new ListaService(jogadores, sessoes).adicionar(
      '5511@s.whatsapp.net',
      'João',
    );

    expect(resultado.adicionado).toBe(true);
    expect(sessoes.adicionarParticipante).toHaveBeenCalledWith('sessao-1', 'jogador-1');
  });

  it('informa ambiguidade ao remover por nome parcial', async () => {
    const jogadores = criarRepositorioJogadorMock();
    const sessoes = criarRepositorioSessaoMock();
    vi.mocked(sessoes.obterOuCriarAberta).mockResolvedValue({
      id: 'sessao-1',
      participantes: [
        { ...jogador('1', 'João Silva'), confirmadoEm: new Date() },
        { ...jogador('2', 'João Souza'), confirmadoEm: new Date() },
      ],
    });

    const resultado = await new ListaService(jogadores, sessoes).remover('joao');

    expect(resultado.tipo).toBe('ambiguo');
    expect(sessoes.removerParticipante).not.toHaveBeenCalled();
  });
});
