import type { PrismaClient } from '@prisma/client';
import type { Jogador } from '../models/types.js';

export interface RepositorioJogador {
  salvar(jid: string, nome: string): Promise<Jogador>;
  buscarPorJid(jid: string): Promise<Jogador | null>;
  listar(): Promise<Jogador[]>;
}

export class RepositorioJogadorPrisma implements RepositorioJogador {
  public constructor(private readonly prisma: PrismaClient) {}

  public salvar(jid: string, nome: string): Promise<Jogador> {
    return this.prisma.player.upsert({
      where: { jid },
      create: { jid, nome },
      update: { nome },
      select: { id: true, jid: true, nome: true },
    });
  }

  public buscarPorJid(jid: string): Promise<Jogador | null> {
    return this.prisma.player.findUnique({
      where: { jid },
      select: { id: true, jid: true, nome: true },
    });
  }

  public listar(): Promise<Jogador[]> {
    return this.prisma.player.findMany({
      select: { id: true, jid: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }
}
