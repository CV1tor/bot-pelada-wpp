import { describe, expect, it, vi } from 'vitest';
import { ListaService } from '../../src/services/lista.service.js';
import { criarRepositorioJogadorMock, criarRepositorioSessaoMock, jogador } from '../helpers.js';

describe('ListaService', () => {
  it('salva o jogador e o adiciona à sessão aberta', async () => {
    const jogadores = criarRepositorioJogadorMock();
    const sessoes = criarRepositorioSessaoMock();
    vi.mocked(jogadores.salvar).mockResolvedValue(jogador());
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: new Date(),
      valorTotalCentavos: 20000,
      participantes: [],
    });
    vi.mocked(sessoes.adicionarParticipante).mockResolvedValue(true);

    const resultado = await new ListaService(jogadores, sessoes).adicionar(
      '5511@s.whatsapp.net',
      'João',
    );

    expect(resultado.tipo).toBe('adicionado');
    expect(sessoes.adicionarParticipante).toHaveBeenCalledWith('sessao-1', 'jogador-1');
  });

  it('salva um jogador avulso pelo nome e o adiciona à sessão aberta', async () => {
    const jogadores = criarRepositorioJogadorMock();
    const sessoes = criarRepositorioSessaoMock();
    vi.mocked(jogadores.salvarAvulso).mockResolvedValue(
      jogador('avulso-1', 'José da Silva', 'avulso:jose-da-silva'),
    );
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: new Date(),
      valorTotalCentavos: 20000,
      participantes: [],
    });
    vi.mocked(sessoes.adicionarParticipante).mockResolvedValue(true);

    const resultado = await new ListaService(jogadores, sessoes).adicionarAvulso('José da Silva');

    expect(resultado).toMatchObject({ tipo: 'adicionado', jogador: { nome: 'José da Silva' } });
    expect(jogadores.salvarAvulso).toHaveBeenCalledWith('José da Silva');
    expect(sessoes.adicionarParticipante).toHaveBeenCalledWith('sessao-1', 'avulso-1');
  });

  it('informa ambiguidade ao remover por nome parcial', async () => {
    const jogadores = criarRepositorioJogadorMock();
    const sessoes = criarRepositorioSessaoMock();
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: new Date(),
      valorTotalCentavos: 20000,
      participantes: [
        {
          ...jogador('1', 'João Silva'),
          confirmadoEm: new Date(),
          canceladoEm: null,
          presente: false,
          pagoEm: null,
          valorPagoCentavos: null,
        },
        {
          ...jogador('2', 'João Souza'),
          confirmadoEm: new Date(),
          canceladoEm: null,
          presente: false,
          pagoEm: null,
          valorPagoCentavos: null,
        },
      ],
    });

    const resultado = await new ListaService(jogadores, sessoes).remover('joao');

    expect(resultado.tipo).toBe('ambiguo');
    expect(sessoes.removerParticipante).not.toHaveBeenCalled();
  });
});
