import type { Jogador, SessaoAberta } from '../models/types.js';
import type { SituacaoFinanceira } from '../models/types.js';
import type { RepositorioJogador } from '../repositories/player.repository.js';
import type { RepositorioSessao } from '../repositories/sessao.repository.js';
import {
  resolverJogadorPorNome,
  type ResultadoResolucaoJogador,
} from '../utils/resolver-jogador.js';

export type ResultadoAdicao =
  | { tipo: 'adicionado' | 'duplicado'; jogador: Jogador }
  | { tipo: 'sem_sessao' };
export type ResultadoRemocao =
  | { tipo: 'removido'; jogador: Jogador }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ambiguo'; jogadores: Jogador[] }
  | { tipo: 'sem_sessao' };

export type ResultadoSaida =
  | { tipo: 'removido'; jogador: Jogador }
  | { tipo: 'nao_confirmado' }
  | { tipo: 'sem_sessao' };

export class ListaService {
  public constructor(
    private readonly repositorioJogador: RepositorioJogador,
    private readonly repositorioSessao: RepositorioSessao,
  ) {}

  public obterLista(): Promise<SessaoAberta | null> {
    return this.repositorioSessao.buscarAberta();
  }

  public obterSituacaoFinanceira(sessaoId: string): Promise<SituacaoFinanceira> {
    return this.repositorioSessao.obterSituacaoFinanceira(sessaoId);
  }

  public async adicionar(jid: string, nome: string): Promise<ResultadoAdicao> {
    const jogador = await this.repositorioJogador.salvar(jid, nome);
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    const adicionado = await this.repositorioSessao.adicionarParticipante(sessao.id, jogador.id);
    return { tipo: adicionado ? 'adicionado' : 'duplicado', jogador };
  }

  public async adicionarMencionado(jid: string): Promise<ResultadoAdicao> {
    const jogadorExistente = await this.repositorioJogador.buscarPorJid(jid);
    return this.adicionar(jid, jogadorExistente?.nome ?? jid.split('@')[0] ?? jid);
  }

  public async adicionarAvulso(nome: string): Promise<ResultadoAdicao> {
    const jogador = await this.repositorioJogador.salvarAvulso(nome);
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    const adicionado = await this.repositorioSessao.adicionarParticipante(sessao.id, jogador.id);
    return { tipo: adicionado ? 'adicionado' : 'duplicado', jogador };
  }

  public async remover(nome: string): Promise<ResultadoRemocao> {
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    const resolucao: ResultadoResolucaoJogador = resolverJogadorPorNome(sessao.participantes, nome);
    if (resolucao.tipo !== 'encontrado') return resolucao;
    await this.repositorioSessao.removerParticipante(sessao.id, resolucao.jogador.id);
    return { tipo: 'removido', jogador: resolucao.jogador };
  }

  public async sair(jid: string): Promise<ResultadoSaida> {
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    const jogador = await this.repositorioJogador.buscarPorJid(jid);
    if (!jogador) return { tipo: 'nao_confirmado' };
    const removido = await this.repositorioSessao.removerParticipante(sessao.id, jogador.id);
    return removido ? { tipo: 'removido', jogador } : { tipo: 'nao_confirmado' };
  }

  public async limpar(): Promise<number | null> {
    const sessao = await this.repositorioSessao.buscarAberta();
    return sessao ? this.repositorioSessao.limparParticipantes(sessao.id) : null;
  }
}
