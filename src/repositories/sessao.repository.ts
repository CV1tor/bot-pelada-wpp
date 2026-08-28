import { Prisma, type PrismaClient } from '@prisma/client';
import type { JogadorAvaliado, Participante, SessaoAberta, TimeSorteado } from '../models/types.js';

export interface RepositorioSessao {
  obterOuCriarAberta(): Promise<SessaoAberta>;
  adicionarParticipante(sessaoId: string, playerId: string): Promise<boolean>;
  removerParticipante(sessaoId: string, playerId: string): Promise<boolean>;
  limparParticipantes(sessaoId: string): Promise<number>;
  listarParticipantesAvaliados(sessaoId: string): Promise<JogadorAvaliado[]>;
  substituirTimes(sessaoId: string, times: TimeSorteado[]): Promise<void>;
}

const selecaoSessao = {
  id: true,
  participantes: {
    orderBy: { confirmadoEm: 'asc' as const },
    select: {
      confirmadoEm: true,
      player: { select: { id: true, jid: true, nome: true } },
    },
  },
};

export class RepositorioSessaoPrisma implements RepositorioSessao {
  public constructor(private readonly prisma: PrismaClient) {}

  public async obterOuCriarAberta(): Promise<SessaoAberta> {
    const encontrada = await this.prisma.sessao.findUnique({
      where: { chaveAberta: 'ATIVA' },
      select: selecaoSessao,
    });
    if (encontrada) return this.mapearSessao(encontrada);

    try {
      const criada = await this.prisma.sessao.create({
        data: { chaveAberta: 'ATIVA' },
        select: selecaoSessao,
      });
      return this.mapearSessao(criada);
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== 'P2002')
        throw erro;
      const criadaConcorrentemente = await this.prisma.sessao.findUniqueOrThrow({
        where: { chaveAberta: 'ATIVA' },
        select: selecaoSessao,
      });
      return this.mapearSessao(criadaConcorrentemente);
    }
  }

  public async adicionarParticipante(sessaoId: string, playerId: string): Promise<boolean> {
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
    const resultado = await this.prisma.listaParticipante.deleteMany({
      where: { sessaoId, playerId },
    });
    return resultado.count > 0;
  }

  public async limparParticipantes(sessaoId: string): Promise<number> {
    const resultado = await this.prisma.listaParticipante.deleteMany({ where: { sessaoId } });
    return resultado.count;
  }

  public async listarParticipantesAvaliados(sessaoId: string): Promise<JogadorAvaliado[]> {
    const participantes = await this.prisma.listaParticipante.findMany({
      where: { sessaoId },
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
    participantes: Array<{ confirmadoEm: Date; player: Omit<Participante, 'confirmadoEm'> }>;
  }): SessaoAberta {
    return {
      id: sessao.id,
      participantes: sessao.participantes.map(({ player, confirmadoEm }) => ({
        ...player,
        confirmadoEm,
      })),
    };
  }
}
