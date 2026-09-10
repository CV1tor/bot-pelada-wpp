import type { EstatisticasJogador } from '../models/types.js';
import type { RepositorioEstatisticas } from '../repositories/estatisticas.repository.js';
import type { RepositorioJogador } from '../repositories/player.repository.js';
import { resolverJogadorPorNome } from '../utils/resolver-jogador.js';

export type ResultadoEstatisticas =
  | { tipo: 'encontrado'; estatisticas: EstatisticasJogador }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ambiguo'; nomes: string[] };

export class EstatisticasService {
  public constructor(
    private readonly repositorioJogador: RepositorioJogador,
    private readonly repositorioEstatisticas: RepositorioEstatisticas,
  ) {}

  public async obter(
    jidSolicitante: string,
    nomeConsultado: string,
    jidMencionado?: string,
  ): Promise<ResultadoEstatisticas> {
    if (!nomeConsultado || jidMencionado) {
      const jogador = await this.repositorioJogador.buscarPorJid(jidMencionado ?? jidSolicitante);
      return jogador
        ? {
            tipo: 'encontrado',
            estatisticas: await this.repositorioEstatisticas.obterDoJogador(jogador),
          }
        : { tipo: 'nao_encontrado' };
    }
    const resolucao = resolverJogadorPorNome(
      await this.repositorioJogador.listar(),
      nomeConsultado,
    );
    if (resolucao.tipo === 'nao_encontrado') return resolucao;
    if (resolucao.tipo === 'ambiguo') {
      return { tipo: 'ambiguo', nomes: resolucao.jogadores.map(({ nome }) => nome) };
    }
    return {
      tipo: 'encontrado',
      estatisticas: await this.repositorioEstatisticas.obterDoJogador(resolucao.jogador),
    };
  }
}
