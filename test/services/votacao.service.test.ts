import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VotacaoService } from '../../src/services/votacao.service.js';
import {
  criarClienteEvolutionMock,
  criarRepositorioAvaliacaoMock,
  criarRepositorioJogadorMock,
  criarRepositorioVotacaoMock,
  jogador,
  votacao,
} from '../helpers.js';

describe('VotacaoService', () => {
  const agora = new Date('2026-08-28T13:00:00.000Z');
  const jogadores = criarRepositorioJogadorMock();
  const votacoes = criarRepositorioVotacaoMock();
  const avaliacoes = criarRepositorioAvaliacaoMock();
  const evolution = criarClienteEvolutionMock();
  const criarServico = () =>
    new VotacaoService(jogadores, votacoes, avaliacoes, evolution, () => agora);

  beforeEach(() => vi.resetAllMocks());

  it('abre enquete nativa e persiste ID e segredo', async () => {
    vi.mocked(votacoes.buscarAtivaPorGrupo).mockResolvedValue(null);
    vi.mocked(jogadores.listar).mockResolvedValue([jogador()]);
    vi.mocked(votacoes.criar).mockResolvedValue(votacao());
    vi.mocked(evolution.enviarEnquete).mockResolvedValue({
      mensagemId: 'poll-1',
      segredo: 'segredo',
    });

    const resultado = await criarServico().iniciar('joao', 'grupo@g.us');

    expect(resultado).toMatchObject({ tipo: 'aberta', enqueteNativa: true });
    expect(evolution.enviarEnquete).toHaveBeenCalledWith(
      'grupo@g.us',
      'Avaliação de João',
      ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'],
      1,
    );
    expect(votacoes.vincularEnquete).toHaveBeenCalledWith('votacao-1', 'poll-1', 'segredo');
  });

  it('mantém fallback textual quando a enquete falha', async () => {
    vi.mocked(votacoes.buscarAtivaPorGrupo).mockResolvedValue(null);
    vi.mocked(jogadores.listar).mockResolvedValue([jogador()]);
    vi.mocked(votacoes.criar).mockResolvedValue(votacao());
    vi.mocked(evolution.enviarEnquete).mockRejectedValue(new Error('indisponível'));

    await expect(criarServico().iniciar('João', 'grupo@g.us')).resolves.toMatchObject({
      tipo: 'aberta',
      enqueteNativa: false,
    });
  });

  it('registra opção recebida pela enquete e permite atualizar a seleção', async () => {
    vi.mocked(votacoes.buscarPorMensagemEnquete).mockResolvedValue({
      ...votacao(),
      pollMessageId: 'poll-1',
    });
    vi.mocked(jogadores.buscarPorJid).mockResolvedValue(
      jogador('avaliador', 'Maria', '5522@s.whatsapp.net'),
    );
    vi.mocked(avaliacoes.registrar).mockResolvedValue(true);

    const resultado = await criarServico().registrarVotoEnquete('poll-1', '5522@s.whatsapp.net', [
      '4 ⭐',
    ]);

    expect(resultado).toMatchObject({ tipo: 'registrado', estrelas: 4 });
    expect(avaliacoes.registrar).toHaveBeenCalledWith(
      'votacao-1',
      'avaliador',
      'jogador-1',
      4,
      true,
    );
  });

  it('impede autoavaliação', async () => {
    vi.mocked(votacoes.buscarAtivaPorGrupo).mockResolvedValue(votacao());
    vi.mocked(jogadores.buscarPorJid).mockResolvedValue(jogador());

    await expect(
      criarServico().registrarVotoTexto('grupo@g.us', '5511@s.whatsapp.net', 5),
    ).resolves.toEqual({
      tipo: 'autoavaliacao',
    });
  });

  it('fecha votação expirada uma única vez e consolida o resultado', async () => {
    vi.mocked(votacoes.listarExpiradas).mockResolvedValue([votacao()]);
    vi.mocked(votacoes.fechar).mockResolvedValue(true);
    vi.mocked(avaliacoes.obterResultado).mockResolvedValue({ media: 4.5, total: 2 });

    const resultados = await criarServico().fecharExpiradas();

    expect(resultados[0]?.resultado).toMatchObject({ media: 4.5, totalVotos: 2 });
  });
});
