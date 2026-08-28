import type { Jogador, SessaoAberta } from '../models/types.js';
import type { RepositorioJogador } from '../repositories/player.repository.js';
import type { RepositorioSessao } from '../repositories/sessao.repository.js';
import {
  resolverJogadorPorNome,
  type ResultadoResolucaoJogador,
} from '../utils/resolver-jogador.js';

export type ResultadoAdicao = { adicionado: boolean; jogador: Jogador };
export type ResultadoRemocao =
  | { tipo: 'removido'; jogador: Jogador }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ambiguo'; jogadores: Jogador[] };

export class ListaService {
  public constructor(
    private readonly repositorioJogador: RepositorioJogador,
    private readonly repositorioSessao: RepositorioSessao,
  ) {}

  public obterLista(): Promise<SessaoAberta> {
    return this.repositorioSessao.obterOuCriarAberta();
  }

  public async adicionar(jid: string, nome: string): Promise<ResultadoAdicao> {
    const jogador = await this.repositorioJogador.salvar(jid, nome);
    const sessao = await this.repositorioSessao.obterOuCriarAberta();
    const adicionado = await this.repositorioSessao.adicionarParticipante(sessao.id, jogador.id);
    return { adicionado, jogador };
  }

  public async adicionarMencionado(jid: string): Promise<ResultadoAdicao> {
    const jogadorExistente = await this.repositorioJogador.buscarPorJid(jid);
    return this.adicionar(jid, jogadorExistente?.nome ?? jid.split('@')[0] ?? jid);
  }

  public async adicionarAvulso(nome: string): Promise<ResultadoAdicao> {
    const jogador = await this.repositorioJogador.salvarAvulso(nome);
    const sessao = await this.repositorioSessao.obterOuCriarAberta();
    const adicionado = await this.repositorioSessao.adicionarParticipante(sessao.id, jogador.id);
    return { adicionado, jogador };
  }

  public async remover(nome: string): Promise<ResultadoRemocao> {
    const sessao = await this.repositorioSessao.obterOuCriarAberta();
    const resolucao: ResultadoResolucaoJogador = resolverJogadorPorNome(sessao.participantes, nome);
    if (resolucao.tipo !== 'encontrado') return resolucao;
    await this.repositorioSessao.removerParticipante(sessao.id, resolucao.jogador.id);
    return { tipo: 'removido', jogador: resolucao.jogador };
  }

  public async limpar(): Promise<number> {
    const sessao = await this.repositorioSessao.obterOuCriarAberta();
    return this.repositorioSessao.limparParticipantes(sessao.id);
  }
}
