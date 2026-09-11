import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessaoService } from '../../src/services/sessao.service.js';
import { criarRepositorioJogadorMock, criarRepositorioSessaoMock, jogador } from '../helpers.js';

describe('SessaoService', () => {
  const agora = new Date('2026-09-10T18:00:00.000Z');
  const dataPelada = new Date('2026-09-15T23:00:00.000Z');
  const jogadores = criarRepositorioJogadorMock();
  const sessoes = criarRepositorioSessaoMock();
  const servico = new SessaoService(sessoes, jogadores, () => agora);

  beforeEach(() => vi.resetAllMocks());

  it('abre uma sessão com data e valor total', async () => {
    vi.mocked(sessoes.buscarAberta).mockResolvedValue(null);
    vi.mocked(sessoes.criar).mockResolvedValue({
      id: 'sessao-1',
      data: dataPelada,
      valorTotalCentavos: 20000,
      participantes: [],
    });

    await expect(servico.abrir(dataPelada, 20000)).resolves.toMatchObject({ tipo: 'aberta' });
    expect(sessoes.criar).toHaveBeenCalledWith(dataPelada, 20000);
  });

  it('configura a sessão implícita criada por versões anteriores', async () => {
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-legada',
      data: agora,
      valorTotalCentavos: 0,
      participantes: [],
    });
    vi.mocked(sessoes.configurar).mockResolvedValue({
      id: 'sessao-legada',
      data: dataPelada,
      valorTotalCentavos: 20000,
      participantes: [],
    });

    await expect(servico.abrir(dataPelada, 20000)).resolves.toMatchObject({ tipo: 'aberta' });
    expect(sessoes.configurar).toHaveBeenCalledWith('sessao-legada', dataPelada, 20000);
  });

  it('encerra e transforma os confirmados em presenças', async () => {
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: dataPelada,
      valorTotalCentavos: 20000,
      participantes: [],
    });
    vi.mocked(sessoes.obterSituacaoFinanceira).mockResolvedValue({
      valorTotalCentavos: 20000,
      valorRecebidoCentavos: 10000,
      saldoCentavos: 10000,
      quantidadePendentes: 1,
      valorIndividualCentavos: 10000,
    });
    vi.mocked(sessoes.encerrar).mockResolvedValue(8);

    await expect(servico.encerrar()).resolves.toMatchObject({
      tipo: 'encerrada',
      quantidadePresentes: 8,
    });
    expect(sessoes.encerrar).toHaveBeenCalledWith('sessao-1', agora);
  });

  it('registra o pagamento do próprio jogador confirmado', async () => {
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: dataPelada,
      valorTotalCentavos: 20000,
      participantes: [],
    });
    vi.mocked(jogadores.buscarPorJid).mockResolvedValue(jogador());
    vi.mocked(sessoes.registrarPagamento).mockResolvedValue({
      tipo: 'registrado',
      valorPagoCentavos: 2000,
      situacao: {
        valorTotalCentavos: 20000,
        valorRecebidoCentavos: 2000,
        saldoCentavos: 18000,
        quantidadePendentes: 9,
        valorIndividualCentavos: 2000,
      },
    });

    await expect(servico.pagar('5511@s.whatsapp.net')).resolves.toMatchObject({
      tipo: 'registrado',
      valorPagoCentavos: 2000,
    });
    expect(sessoes.registrarPagamento).toHaveBeenCalledWith('sessao-1', 'jogador-1', agora);
  });

  it('registra o pagamento de um participante confirmado pelo nome', async () => {
    const participante = {
      ...jogador('jogador-2', 'Carlos Eduardo', '5522@s.whatsapp.net'),
      confirmadoEm: agora,
      canceladoEm: null,
      presente: false,
      pagoEm: null,
      valorPagoCentavos: null,
    };
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: dataPelada,
      valorTotalCentavos: 20000,
      participantes: [participante],
    });
    vi.mocked(sessoes.registrarPagamento).mockResolvedValue({
      tipo: 'registrado',
      valorPagoCentavos: 2000,
      situacao: {
        valorTotalCentavos: 20000,
        valorRecebidoCentavos: 2000,
        saldoCentavos: 18000,
        quantidadePendentes: 9,
        valorIndividualCentavos: 2000,
      },
    });

    await expect(servico.pagar('5511@s.whatsapp.net', 'carlos')).resolves.toMatchObject({
      tipo: 'registrado',
      jogador: participante,
    });
    expect(jogadores.buscarPorJid).not.toHaveBeenCalled();
    expect(sessoes.registrarPagamento).toHaveBeenCalledWith('sessao-1', 'jogador-2', agora);
  });

  it('não registra pagamento quando o nome é ambíguo', async () => {
    const criarParticipante = (id: string, nome: string) => ({
      ...jogador(id, nome),
      confirmadoEm: agora,
      canceladoEm: null,
      presente: false,
      pagoEm: null,
      valorPagoCentavos: null,
    });
    vi.mocked(sessoes.buscarAberta).mockResolvedValue({
      id: 'sessao-1',
      data: dataPelada,
      valorTotalCentavos: 20000,
      participantes: [
        criarParticipante('jogador-2', 'Carlos Eduardo'),
        criarParticipante('jogador-3', 'Carlos Alberto'),
      ],
    });

    await expect(servico.pagar('5511@s.whatsapp.net', 'Carlos')).resolves.toMatchObject({
      tipo: 'ambiguo',
    });
    expect(sessoes.registrarPagamento).not.toHaveBeenCalled();
  });
});
