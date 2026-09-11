import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VotacaoService } from '../../src/services/votacao.service.js';
import {
  criarClienteEvolutionMock,
  criarRepositorioAvaliacaoMock,
  criarRepositorioJogadorMock,
  criarRepositorioSessaoMock,
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
  const sessoes = criarRepositorioSessaoMock();
  const criarServico = () =>
    new VotacaoService(jogadores, votacoes, avaliacoes, evolution, sessoes, () => agora);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: agora,
      valorTotalCentavos: 20000,
      participantes: [
        {
          ...jogador(),
          confirmadoEm: agora,
          canceladoEm: null,
          presente: false,
          pagoEm: null,
          valorPagoCentavos: null,
        },
      ],
    });
  });

  it('abre enquete nativa e persiste ID e segredo', async () => {
    vi.mocked(votacoes.buscarAtivaPorJogadorNaSessao).mockResolvedValue(null);
    vi.mocked(votacoes.criar).mockResolvedValue(votacao());
    vi.mocked(evolution.enviarEnquete).mockResolvedValue({
      mensagemId: 'poll-1',
      segredo: 'segredo',
    });

    const resultado = await criarServico().iniciar('joao', 'grupo@g.us');

    expect(resultado).toMatchObject({ tipo: 'aberta' });
    expect(evolution.enviarEnquete).toHaveBeenCalledWith(
      'grupo@g.us',
      'Avaliação de João',
      ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'],
      1,
    );
    expect(votacoes.criar).toHaveBeenCalledWith(
      'jogador-1',
      'grupo@g.us',
      'sessao-1',
      new Date('2026-08-29T13:00:00.000Z'),
    );
    expect(votacoes.vincularEnquete).toHaveBeenCalledWith('votacao-1', 'poll-1', 'segredo');
  });

  it('cancela a votação quando a enquete nativa falha', async () => {
    vi.mocked(votacoes.buscarAtivaPorJogadorNaSessao).mockResolvedValue(null);
    vi.mocked(votacoes.criar).mockResolvedValue(votacao());
    vi.mocked(evolution.enviarEnquete).mockRejectedValue(new Error('indisponível'));

    await expect(criarServico().iniciar('João', 'grupo@g.us')).resolves.toEqual({
      tipo: 'falha_enquete',
    });
    expect(votacoes.fechar).toHaveBeenCalledWith('votacao-1');
  });

  it('permite abrir votações simultâneas para jogadores diferentes', async () => {
    vi.mocked(votacoes.buscarAtivaPorJogadorNaSessao).mockResolvedValue(null);
    vi.mocked(votacoes.criar).mockResolvedValue(votacao());
    vi.mocked(evolution.enviarEnquete).mockResolvedValue({ mensagemId: 'poll-1', segredo: null });

    await expect(criarServico().iniciar('João', 'grupo@g.us')).resolves.toMatchObject({
      tipo: 'aberta',
    });

    expect(votacoes.listarAtivasPorGrupo).not.toHaveBeenCalled();
  });

  it('impede outra votação do mesmo jogador na mesma pelada', async () => {
    vi.mocked(votacoes.buscarAtivaPorJogadorNaSessao).mockResolvedValue(votacao());

    await expect(criarServico().iniciar('João', 'grupo@g.us')).resolves.toMatchObject({
      tipo: 'ja_existe',
    });
    expect(evolution.enviarEnquete).not.toHaveBeenCalled();
  });

  it('abre votações para todos os jogadores confirmados', async () => {
    const maria = jogador('jogador-2', 'Maria', '5522@s.whatsapp.net');
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: agora,
      valorTotalCentavos: 20000,
      participantes: [
        {
          ...jogador(),
          confirmadoEm: agora,
          canceladoEm: null,
          presente: false,
          pagoEm: null,
          valorPagoCentavos: null,
        },
        {
          ...maria,
          confirmadoEm: agora,
          canceladoEm: null,
          presente: false,
          pagoEm: null,
          valorPagoCentavos: null,
        },
      ],
    });
    vi.mocked(votacoes.buscarAtivaPorJogadorNaSessao).mockResolvedValue(null);
    vi.mocked(votacoes.criar)
      .mockResolvedValueOnce(votacao())
      .mockResolvedValueOnce({ ...votacao(), id: 'votacao-2', jogador: maria });
    vi.mocked(evolution.enviarEnquete)
      .mockResolvedValueOnce({ mensagemId: 'poll-1', segredo: null })
      .mockResolvedValueOnce({ mensagemId: 'poll-2', segredo: null });

    const resultado = await criarServico().iniciarTodos('grupo@g.us');

    expect(resultado).toMatchObject({
      tipo: 'processada',
      abertas: [{ id: 'votacao-1' }, { id: 'votacao-2' }],
      existentes: [],
      falhas: [],
    });
    expect(votacoes.criar).toHaveBeenNthCalledWith(
      2,
      'jogador-2',
      'grupo@g.us',
      'sessao-1',
      new Date('2026-08-29T13:00:00.000Z'),
    );
    expect(evolution.enviarEnquete).toHaveBeenNthCalledWith(
      2,
      'grupo@g.us',
      'Avaliação de Maria',
      ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'],
      1,
    );
  });

  it('continua abrindo para os demais quando há votação ativa ou falha', async () => {
    const maria = jogador('jogador-2', 'Maria', '5522@s.whatsapp.net');
    const pedro = jogador('jogador-3', 'Pedro', '5533@s.whatsapp.net');
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: agora,
      valorTotalCentavos: 20000,
      participantes: [jogador(), maria, pedro].map((participante) => ({
        ...participante,
        confirmadoEm: agora,
        canceladoEm: null,
        presente: false,
        pagoEm: null,
        valorPagoCentavos: null,
      })),
    });
    vi.mocked(votacoes.buscarAtivaPorJogadorNaSessao)
      .mockResolvedValueOnce(votacao())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(votacoes.criar)
      .mockResolvedValueOnce({ ...votacao(), id: 'votacao-2', jogador: maria })
      .mockResolvedValueOnce({ ...votacao(), id: 'votacao-3', jogador: pedro });
    vi.mocked(evolution.enviarEnquete)
      .mockRejectedValueOnce(new Error('indisponível'))
      .mockResolvedValueOnce({ mensagemId: 'poll-3', segredo: null });

    const resultado = await criarServico().iniciarTodos('grupo@g.us');

    expect(resultado).toMatchObject({
      tipo: 'processada',
      abertas: [{ id: 'votacao-3' }],
      existentes: [{ id: 'votacao-1' }],
      falhas: [{ id: 'jogador-2' }],
    });
    expect(votacoes.fechar).toHaveBeenCalledWith('votacao-2');
    expect(evolution.enviarEnquete).toHaveBeenCalledTimes(2);
  });

  it('informa quando a lista de confirmados está vazia', async () => {
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: agora,
      valorTotalCentavos: 20000,
      participantes: [],
    });

    await expect(criarServico().iniciarTodos('grupo@g.us')).resolves.toEqual({
      tipo: 'sem_participantes',
    });
    expect(votacoes.criar).not.toHaveBeenCalled();
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

  it('impede autoavaliação pela enquete', async () => {
    vi.mocked(votacoes.buscarPorMensagemEnquete).mockResolvedValue({
      ...votacao(),
      pollMessageId: 'poll-1',
    });
    vi.mocked(jogadores.buscarPorJid).mockResolvedValue(jogador());

    await expect(
      criarServico().registrarVotoEnquete('poll-1', '5511@s.whatsapp.net', ['5 ⭐']),
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

  it('encerra votação ativa imediatamente e consolida o resultado', async () => {
    vi.mocked(votacoes.listarAtivasPorGrupo).mockResolvedValue([votacao()]);
    vi.mocked(votacoes.fechar).mockResolvedValue(true);
    vi.mocked(avaliacoes.obterResultado).mockResolvedValue({ media: 4, total: 3 });

    const resultado = await criarServico().encerrarAtiva('João', 'grupo@g.us');

    expect(votacoes.listarAtivasPorGrupo).toHaveBeenCalledWith('grupo@g.us', agora);
    expect(votacoes.fechar).toHaveBeenCalledWith('votacao-1');
    expect(resultado).toMatchObject({
      tipo: 'encerrada',
      votacao: { fechada: true },
      resultado: { media: 4, totalVotos: 3 },
    });
  });

  it('não consolida novamente uma votação encerrada concorrentemente', async () => {
    vi.mocked(votacoes.listarAtivasPorGrupo).mockResolvedValue([votacao()]);
    vi.mocked(votacoes.fechar).mockResolvedValue(false);

    await expect(criarServico().encerrarAtiva('João', 'grupo@g.us')).resolves.toEqual({
      tipo: 'sem_votacao',
    });
    expect(avaliacoes.obterResultado).not.toHaveBeenCalled();
  });
});
