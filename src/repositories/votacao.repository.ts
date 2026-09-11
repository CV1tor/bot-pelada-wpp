import { Prisma, type PrismaClient } from '@prisma/client';
import type { Votacao } from '../models/types.js';

export interface RepositorioVotacao {
  criar(
    playerId: string,
    grupoJid: string,
    sessaoId: string,
    expiraEm: Date,
  ): Promise<Votacao | null>;
  vincularEnquete(id: string, mensagemId: string, segredo: string | null): Promise<void>;
  buscarAtivaPorJogadorNaSessao(
    playerId: string,
    sessaoId: string,
    agora: Date,
  ): Promise<Votacao | null>;
  listarAtivasPorGrupo(grupoJid: string, agora: Date): Promise<Votacao[]>;
  buscarPorMensagemEnquete(mensagemId: string): Promise<Votacao | null>;
  listarExpiradas(agora: Date): Promise<Votacao[]>;
  fechar(id: string): Promise<boolean>;
}

const selecaoVotacao = {
  id: true,
  grupoJid: true,
  sessaoId: true,
  expiraEm: true,
  fechada: true,
  pollMessageId: true,
  pollMessageSecret: true,
  player: { select: { id: true, jid: true, nome: true } },
};

export class RepositorioVotacaoPrisma implements RepositorioVotacao {
  public constructor(private readonly prisma: PrismaClient) {}

  public async criar(
    playerId: string,
    grupoJid: string,
    sessaoId: string,
    expiraEm: Date,
  ): Promise<Votacao | null> {
    try {
      const votacao = await this.prisma.votacaoAtiva.create({
        data: { playerId, grupoJid, sessaoId, expiraEm },
        select: selecaoVotacao,
      });
      return this.mapear(votacao);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')
        return null;
      throw erro;
    }
  }

  public async vincularEnquete(
    id: string,
    mensagemId: string,
    segredo: string | null,
  ): Promise<void> {
    await this.prisma.votacaoAtiva.update({
      where: { id },
      data: { pollMessageId: mensagemId, pollMessageSecret: segredo },
    });
  }

  public async buscarAtivaPorJogadorNaSessao(
    playerId: string,
    sessaoId: string,
    agora: Date,
  ): Promise<Votacao | null> {
    const votacao = await this.prisma.votacaoAtiva.findFirst({
      where: { playerId, sessaoId, fechada: false, expiraEm: { gt: agora } },
      orderBy: { iniciadaEm: 'desc' },
      select: selecaoVotacao,
    });
    return votacao ? this.mapear(votacao) : null;
  }

  public async listarAtivasPorGrupo(grupoJid: string, agora: Date): Promise<Votacao[]> {
    const votacoes = await this.prisma.votacaoAtiva.findMany({
      where: { grupoJid, fechada: false, expiraEm: { gt: agora } },
      orderBy: { iniciadaEm: 'desc' },
      select: selecaoVotacao,
    });
    return votacoes.map((votacao) => this.mapear(votacao));
  }

  public async buscarPorMensagemEnquete(mensagemId: string): Promise<Votacao | null> {
    const votacao = await this.prisma.votacaoAtiva.findUnique({
      where: { pollMessageId: mensagemId },
      select: selecaoVotacao,
    });
    return votacao ? this.mapear(votacao) : null;
  }

  public async listarExpiradas(agora: Date): Promise<Votacao[]> {
    const votacoes = await this.prisma.votacaoAtiva.findMany({
      where: { fechada: false, expiraEm: { lte: agora } },
      select: selecaoVotacao,
    });
    return votacoes.map((votacao) => this.mapear(votacao));
  }

  public async fechar(id: string): Promise<boolean> {
    const resultado = await this.prisma.votacaoAtiva.updateMany({
      where: { id, fechada: false },
      data: { fechada: true },
    });
    return resultado.count > 0;
  }

  private mapear(votacao: {
    id: string;
    grupoJid: string;
    sessaoId: string | null;
    expiraEm: Date;
    fechada: boolean;
    pollMessageId: string | null;
    pollMessageSecret: string | null;
    player: { id: string; jid: string; nome: string };
  }): Votacao {
    const { player, ...dados } = votacao;
    return { ...dados, jogador: player };
  }
}
