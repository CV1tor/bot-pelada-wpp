import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  EstatisticasJogador,
  Jogador,
  JogadorAvaliado,
  ResumoMensal,
} from '../models/types.js';

export interface RepositorioEstatisticas {
  obterDoJogador(jogador: Jogador): Promise<EstatisticasJogador>;
  obterResumoMensal(inicio: Date, fim: Date, competencia: string): Promise<ResumoMensal>;
  possuiVotacaoEmAndamento(inicio: Date, fim: Date, agora: Date): Promise<boolean>;
  reservarPublicacaoMensal(competencia: string): Promise<boolean>;
  liberarPublicacaoMensal(competencia: string): Promise<void>;
}

export class RepositorioEstatisticasPrisma implements RepositorioEstatisticas {
  public constructor(private readonly prisma: PrismaClient) {}

  public async obterDoJogador(jogador: Jogador): Promise<EstatisticasJogador> {
    const [peladasPresentes, avaliacoes, sessoes] = await Promise.all([
      this.prisma.listaParticipante.count({ where: { playerId: jogador.id, presente: true } }),
      this.prisma.avaliacao.aggregate({
        where: { avaliadoId: jogador.id },
        _avg: { estrelas: true },
        _count: { estrelas: true },
      }),
      this.prisma.sessao.findMany({
        where: { status: 'FECHADA' },
        orderBy: { data: 'desc' },
        select: {
          participantes: {
            where: { playerId: jogador.id, presente: true },
            select: { id: true },
          },
        },
      }),
    ]);
    let sequenciaAtual = 0;
    for (const sessao of sessoes) {
      if (!sessao.participantes.length) break;
      sequenciaAtual += 1;
    }
    return {
      jogador,
      peladasPresentes,
      rating: avaliacoes._avg.estrelas,
      totalAvaliacoes: avaliacoes._count.estrelas,
      sequenciaAtual,
    };
  }

  public async obterResumoMensal(
    inicio: Date,
    fim: Date,
    competencia: string,
  ): Promise<ResumoMensal> {
    const [quantidadePeladas, avaliacoes] = await Promise.all([
      this.prisma.sessao.count({ where: { status: 'FECHADA', data: { gte: inicio, lt: fim } } }),
      this.prisma.avaliacao.groupBy({
        by: ['avaliadoId'],
        where: {
          votacao: { sessao: { is: { status: 'FECHADA', data: { gte: inicio, lt: fim } } } },
          avaliado: {
            participacoes: {
              some: {
                presente: true,
                sessao: { status: 'FECHADA', data: { gte: inicio, lt: fim } },
              },
            },
          },
        },
        _avg: { estrelas: true },
        _count: { estrelas: true },
        orderBy: [{ _avg: { estrelas: 'desc' } }, { _count: { estrelas: 'desc' } }],
      }),
    ]);
    const melhor = avaliacoes[0];
    let destaque: JogadorAvaliado | null = null;
    if (melhor && melhor._avg.estrelas !== null) {
      const jogador = await this.prisma.player.findUnique({
        where: { id: melhor.avaliadoId },
        select: { id: true, jid: true, nome: true },
      });
      if (jogador) {
        destaque = {
          ...jogador,
          media: melhor._avg.estrelas,
          totalAvaliacoes: melhor._count.estrelas,
        };
      }
    }
    return { competencia, quantidadePeladas, destaque };
  }

  public async possuiVotacaoEmAndamento(inicio: Date, fim: Date, agora: Date): Promise<boolean> {
    const quantidade = await this.prisma.votacaoAtiva.count({
      where: {
        fechada: false,
        expiraEm: { gt: agora },
        sessao: { is: { data: { gte: inicio, lt: fim } } },
      },
    });
    return quantidade > 0;
  }

  public async reservarPublicacaoMensal(competencia: string): Promise<boolean> {
    try {
      await this.prisma.resumoMensalPublicado.create({ data: { competencia } });
      return true;
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')
        return false;
      throw erro;
    }
  }

  public async liberarPublicacaoMensal(competencia: string): Promise<void> {
    await this.prisma.resumoMensalPublicado.deleteMany({ where: { competencia } });
  }
}
