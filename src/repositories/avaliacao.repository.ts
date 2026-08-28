import { Prisma, type PrismaClient } from '@prisma/client';
import type { JogadorAvaliado } from '../models/types.js';

export interface RepositorioAvaliacao {
  registrar(
    votacaoId: string,
    avaliadorId: string,
    avaliadoId: string,
    estrelas: number,
    permitirAtualizacao: boolean,
  ): Promise<boolean>;
  obterResultado(votacaoId: string): Promise<{ media: number | null; total: number }>;
  listarRanking(minimoAvaliacoes: number): Promise<JogadorAvaliado[]>;
}

export class RepositorioAvaliacaoPrisma implements RepositorioAvaliacao {
  public constructor(private readonly prisma: PrismaClient) {}

  public async registrar(
    votacaoId: string,
    avaliadorId: string,
    avaliadoId: string,
    estrelas: number,
    permitirAtualizacao: boolean,
  ): Promise<boolean> {
    if (permitirAtualizacao) {
      await this.prisma.avaliacao.upsert({
        where: { votacaoId_avaliadorId: { votacaoId, avaliadorId } },
        create: { votacaoId, avaliadorId, avaliadoId, estrelas },
        update: { estrelas },
      });
      return true;
    }
    try {
      await this.prisma.avaliacao.create({
        data: { votacaoId, avaliadorId, avaliadoId, estrelas },
      });
      return true;
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')
        return false;
      throw erro;
    }
  }

  public async obterResultado(votacaoId: string): Promise<{ media: number | null; total: number }> {
    const resultado = await this.prisma.avaliacao.aggregate({
      where: { votacaoId },
      _avg: { estrelas: true },
      _count: { estrelas: true },
    });
    return { media: resultado._avg.estrelas, total: resultado._count.estrelas };
  }

  public async listarRanking(minimoAvaliacoes: number): Promise<JogadorAvaliado[]> {
    const agrupados = await this.prisma.avaliacao.groupBy({
      by: ['avaliadoId'],
      _avg: { estrelas: true },
      _count: { estrelas: true },
      having: { estrelas: { _count: { gte: minimoAvaliacoes } } },
      orderBy: { _avg: { estrelas: 'desc' } },
    });
    const jogadores = await this.prisma.player.findMany({
      where: { id: { in: agrupados.map(({ avaliadoId }) => avaliadoId) } },
      select: { id: true, jid: true, nome: true },
    });
    const jogadoresPorId = new Map(jogadores.map((jogador) => [jogador.id, jogador]));
    return agrupados.flatMap((avaliacao) => {
      const jogador = jogadoresPorId.get(avaliacao.avaliadoId);
      return jogador && avaliacao._avg.estrelas !== null
        ? [
            {
              ...jogador,
              media: avaliacao._avg.estrelas,
              totalAvaliacoes: avaliacao._count.estrelas,
            },
          ]
        : [];
    });
  }
}
