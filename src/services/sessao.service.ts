import type { SessaoAberta, SituacaoFinanceira } from '../models/types.js';
import type { RepositorioJogador } from '../repositories/player.repository.js';
import type {
  RepositorioSessao,
  ResultadoPagamentoRepositorio,
} from '../repositories/sessao.repository.js';

export type ResultadoAberturaSessao =
  | { tipo: 'aberta'; sessao: SessaoAberta }
  | { tipo: 'ja_existe'; sessao: SessaoAberta };

export type ResultadoEncerramentoSessao =
  | { tipo: 'encerrada'; quantidadePresentes: number; situacao: SituacaoFinanceira }
  | { tipo: 'sem_sessao' };

export type ResultadoPagamento =
  | ResultadoPagamentoRepositorio
  | { tipo: 'sem_sessao' }
  | { tipo: 'jogador_desconhecido' };

export class SessaoService {
  public constructor(
    private readonly repositorioSessao: RepositorioSessao,
    private readonly repositorioJogador: RepositorioJogador,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  public async abrir(data: Date, valorTotalCentavos: number): Promise<ResultadoAberturaSessao> {
    const aberta = await this.repositorioSessao.buscarAberta();
    if (aberta?.valorTotalCentavos === 0) {
      return {
        tipo: 'aberta',
        sessao: await this.repositorioSessao.configurar(aberta.id, data, valorTotalCentavos),
      };
    }
    if (aberta) return { tipo: 'ja_existe', sessao: aberta };
    return { tipo: 'aberta', sessao: await this.repositorioSessao.criar(data, valorTotalCentavos) };
  }

  public async encerrar(): Promise<ResultadoEncerramentoSessao> {
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    const situacao = await this.repositorioSessao.obterSituacaoFinanceira(sessao.id);
    const quantidadePresentes = await this.repositorioSessao.encerrar(sessao.id, this.agora());
    return { tipo: 'encerrada', quantidadePresentes, situacao };
  }

  public async pagar(jid: string): Promise<ResultadoPagamento> {
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    const jogador = await this.repositorioJogador.buscarPorJid(jid);
    if (!jogador) return { tipo: 'jogador_desconhecido' };
    return this.repositorioSessao.registrarPagamento(sessao.id, jogador.id, this.agora());
  }
}
