import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  JogadorAvaliado,
  Participante,
  SessaoAberta,
  SituacaoFinanceira,
  TimeSorteado,
} from '../models/types.js';
import { calcularSituacaoFinanceira } from '../utils/calcular-situacao-financeira.js';

export type ResultadoPagamentoRepositorio =
  | { tipo: 'registrado'; valorPagoCentavos: number; situacao: SituacaoFinanceira }
  | { tipo: 'ja_pago'; valorPagoCentavos: number; situacao: SituacaoFinanceira }
  | { tipo: 'nao_confirmado' };

export interface RepositorioSessao {
  buscarAberta(): Promise<SessaoAberta | null>;
  criar(data: Date, valorTotalCentavos: number): Promise<SessaoAberta>;
  configurar(id: string, data: Date, valorTotalCentavos: number): Promise<SessaoAberta>;
  encerrar(id: string, encerradaEm: Date): Promise<number>;
  adicionarParticipante(sessaoId: string, playerId: string): Promise<boolean>;
  removerParticipante(sessaoId: string, playerId: string): Promise<boolean>;
  limparParticipantes(sessaoId: string): Promise<number>;
  obterSituacaoFinanceira(sessaoId: string): Promise<SituacaoFinanceira>;
  registrarPagamento(
    sessaoId: string,
    playerId: string,
    pagoEm: Date,
  ): Promise<ResultadoPagamentoRepositorio>;
  listarParticipantesAvaliados(sessaoId: string): Promise<JogadorAvaliado[]>;
  substituirTimes(sessaoId: string, times: TimeSorteado[]): Promise<void>;
}

const selecaoSessao = {
  id: true,
  data: true,
  valorTotalCentavos: true,
  participantes: {
    where: { canceladoEm: null },
    orderBy: { confirmadoEm: 'asc' as const },
    select: {
      confirmadoEm: true,
      canceladoEm: true,
      presente: true,
      pagoEm: true,
      valorPagoCentavos: true,
      player: { select: { id: true, jid: true, nome: true } },
    },
  },
};

export class RepositorioSessaoPrisma implements RepositorioSessao {
  public constructor(private readonly prisma: PrismaClient) {}

  public async buscarAberta(): Promise<SessaoAberta | null> {
    const sessao = await this.prisma.sessao.findUnique({
      where: { chaveAberta: 'ATIVA' },
      select: selecaoSessao,
    });
    return sessao ? this.mapearSessao(sessao) : null;
  }

  public async criar(data: Date, valorTotalCentavos: number): Promise<SessaoAberta> {
    const sessao = await this.prisma.sessao.create({
      data: { data, valorTotalCentavos, chaveAberta: 'ATIVA' },
      select: selecaoSessao,
    });
    return this.mapearSessao(sessao);
  }

  public async configurar(
    id: string,
    data: Date,
    valorTotalCentavos: number,
  ): Promise<SessaoAberta> {
    const sessao = await this.prisma.sessao.update({
      where: { id },
      data: { data, valorTotalCentavos },
      select: selecaoSessao,
    });
    return this.mapearSessao(sessao);
  }

  public async encerrar(id: string, encerradaEm: Date): Promise<number> {
    return this.prisma.$transaction(async (transacao) => {
      const sessaoEncerrada = await transacao.sessao.updateMany({
        where: { id, status: 'ABERTA', chaveAberta: 'ATIVA' },
        data: { status: 'FECHADA', chaveAberta: null, encerradaEm },
      });
      if (!sessaoEncerrada.count) return 0;
      const participantes = await transacao.listaParticipante.updateMany({
        where: { sessaoId: id, canceladoEm: null },
        data: { presente: true },
      });
      return participantes.count;
    });
  }

  public async adicionarParticipante(sessaoId: string, playerId: string): Promise<boolean> {
    const reativado = await this.prisma.listaParticipante.updateMany({
      where: { sessaoId, playerId, canceladoEm: { not: null } },
      data: { canceladoEm: null, confirmadoEm: new Date() },
    });
    if (reativado.count) return true;
    try {
      await this.prisma.listaParticipante.create({ data: { sessaoId, playerId } });
      return true;
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')
        return false;
      throw erro;
    }
  }

  public async removerParticipante(sessaoId: string, playerId: string): Promise<boolean> {
    const resultado = await this.prisma.listaParticipante.updateMany({
      where: { sessaoId, playerId, canceladoEm: null },
      data: { canceladoEm: new Date() },
    });
    return resultado.count > 0;
  }

  public async limparParticipantes(sessaoId: string): Promise<number> {
    const resultado = await this.prisma.listaParticipante.updateMany({
      where: { sessaoId, canceladoEm: null },
      data: { canceladoEm: new Date() },
    });
    return resultado.count;
  }

  public async obterSituacaoFinanceira(sessaoId: string): Promise<SituacaoFinanceira> {
    const sessao = await this.prisma.sessao.findUniqueOrThrow({
      where: { id: sessaoId },
      select: {
        valorTotalCentavos: true,
        participantes: { select: { canceladoEm: true, pagoEm: true, valorPagoCentavos: true } },
      },
    });
    return calcularSituacaoFinanceira(sessao.valorTotalCentavos, sessao.participantes);
  }

  public registrarPagamento(
    sessaoId: string,
    playerId: string,
    pagoEm: Date,
  ): Promise<ResultadoPagamentoRepositorio> {
    return this.prisma.$transaction(
      async (transacao) => {
        const sessao = await transacao.sessao.findUniqueOrThrow({
          where: { id: sessaoId },
          select: {
            valorTotalCentavos: true,
            participantes: {
              select: { playerId: true, canceladoEm: true, pagoEm: true, valorPagoCentavos: true },
            },
          },
        });
        const participante = sessao.participantes.find(({ playerId: id }) => id === playerId);
        if (!participante || participante.canceladoEm) return { tipo: 'nao_confirmado' };
        const situacaoAtual = calcularSituacaoFinanceira(
          sessao.valorTotalCentavos,
          sessao.participantes,
        );
        if (participante.pagoEm) {
          return {
            tipo: 'ja_pago',
            valorPagoCentavos: participante.valorPagoCentavos ?? 0,
            situacao: situacaoAtual,
          };
        }
        const valorPagoCentavos = situacaoAtual.valorIndividualCentavos;
        await transacao.listaParticipante.update({
          where: { sessaoId_playerId: { sessaoId, playerId } },
          data: { pagoEm, valorPagoCentavos },
        });
        const saldoCentavos = Math.max(0, situacaoAtual.saldoCentavos - valorPagoCentavos);
        const quantidadePendentes = Math.max(0, situacaoAtual.quantidadePendentes - 1);
        return {
          tipo: 'registrado',
          valorPagoCentavos,
          situacao: {
            ...situacaoAtual,
            valorRecebidoCentavos: situacaoAtual.valorRecebidoCentavos + valorPagoCentavos,
            saldoCentavos,
            quantidadePendentes,
            valorIndividualCentavos: quantidadePendentes
              ? Math.round(saldoCentavos / quantidadePendentes)
              : 0,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async listarParticipantesAvaliados(sessaoId: string): Promise<JogadorAvaliado[]> {
    const participantes = await this.prisma.listaParticipante.findMany({
      where: { sessaoId, canceladoEm: null },
      orderBy: { confirmadoEm: 'asc' },
      select: {
        player: {
          select: {
            id: true,
            jid: true,
            nome: true,
            avaliacoesRecebidas: { select: { estrelas: true } },
          },
        },
      },
    });
    return participantes.map(({ player }) => {
      const totalAvaliacoes = player.avaliacoesRecebidas.length;
      const media = totalAvaliacoes
        ? player.avaliacoesRecebidas.reduce((soma, { estrelas }) => soma + estrelas, 0) /
          totalAvaliacoes
        : 3;
      return { id: player.id, jid: player.jid, nome: player.nome, media, totalAvaliacoes };
    });
  }

  public async substituirTimes(sessaoId: string, times: TimeSorteado[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.time.deleteMany({ where: { sessaoId } }),
      ...times.map((time) =>
        this.prisma.time.create({
          data: { sessaoId, numero: time.numero, jogadores: time.jogadores.map(({ id }) => id) },
        }),
      ),
    ]);
  }

  private mapearSessao(sessao: {
    id: string;
    data: Date;
    valorTotalCentavos: number;
    participantes: Array<{
      confirmadoEm: Date;
      canceladoEm: Date | null;
      presente: boolean;
      pagoEm: Date | null;
      valorPagoCentavos: number | null;
      player: Omit<
        Participante,
        'confirmadoEm' | 'canceladoEm' | 'presente' | 'pagoEm' | 'valorPagoCentavos'
      >;
    }>;
  }): SessaoAberta {
    return {
      id: sessao.id,
      data: sessao.data,
      valorTotalCentavos: sessao.valorTotalCentavos,
      participantes: sessao.participantes.map(({ player, ...participacao }) => ({
        ...player,
        ...participacao,
      })),
    };
  }
}
