import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import type { ResultadoVotacao, Votacao } from '../models/types.js';
import type { RepositorioAvaliacao } from '../repositories/avaliacao.repository.js';
import type { RepositorioJogador } from '../repositories/player.repository.js';
import type { RepositorioVotacao } from '../repositories/votacao.repository.js';
import { resolverJogadorPorNome } from '../utils/resolver-jogador.js';

export type ResultadoInicioVotacao =
  | { tipo: 'aberta'; votacao: Votacao; enqueteNativa: boolean }
  | { tipo: 'ja_existe'; votacao: Votacao }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ambiguo'; nomes: string[] };

export type ResultadoRegistroVoto =
  | { tipo: 'registrado'; votacao: Votacao; estrelas: number }
  | { tipo: 'sem_votacao' }
  | { tipo: 'invalido' }
  | { tipo: 'autoavaliacao' }
  | { tipo: 'duplicado' }
  | { tipo: 'avaliador_desconhecido' };

export type ResultadoEncerramentoVotacao =
  | { tipo: 'encerrada'; votacao: Votacao; resultado: ResultadoVotacao }
  | { tipo: 'sem_votacao' };

const OPCOES_ENQUETE = ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'];
const DURACAO_VOTACAO_EM_MILISSEGUNDOS = 3 * 24 * 60 * 60 * 1000;

export class VotacaoService {
  public constructor(
    private readonly repositorioJogador: RepositorioJogador,
    private readonly repositorioVotacao: RepositorioVotacao,
    private readonly repositorioAvaliacao: RepositorioAvaliacao,
    private readonly clienteEvolution: ClienteEvolutionApi,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  public async iniciar(nome: string, grupoJid: string): Promise<ResultadoInicioVotacao> {
    const ativa = await this.repositorioVotacao.buscarAtivaPorGrupo(grupoJid, this.agora());
    if (ativa) return { tipo: 'ja_existe', votacao: ativa };

    const resolucao = resolverJogadorPorNome(await this.repositorioJogador.listar(), nome);
    if (resolucao.tipo === 'nao_encontrado') return { tipo: 'nao_encontrado' };
    if (resolucao.tipo === 'ambiguo') {
      return {
        tipo: 'ambiguo',
        nomes: resolucao.jogadores.map(({ nome: nomeJogador }) => nomeJogador),
      };
    }

    const expiraEm = new Date(this.agora().getTime() + DURACAO_VOTACAO_EM_MILISSEGUNDOS);
    const votacao = await this.repositorioVotacao.criar(resolucao.jogador.id, grupoJid, expiraEm);
    let enquete;
    try {
      enquete = await this.clienteEvolution.enviarEnquete(
        grupoJid,
        `Avaliação de ${resolucao.jogador.nome}`,
        OPCOES_ENQUETE,
        1,
      );
    } catch {
      return { tipo: 'aberta', votacao, enqueteNativa: false };
    }
    await this.repositorioVotacao.vincularEnquete(votacao.id, enquete.mensagemId, enquete.segredo);
    return {
      tipo: 'aberta',
      votacao: {
        ...votacao,
        pollMessageId: enquete.mensagemId,
        pollMessageSecret: enquete.segredo,
      },
      enqueteNativa: true,
    };
  }

  public async registrarVotoTexto(
    grupoJid: string,
    avaliadorJid: string,
    estrelas: number,
  ): Promise<ResultadoRegistroVoto> {
    if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return { tipo: 'invalido' };
    const votacao = await this.repositorioVotacao.buscarAtivaPorGrupo(grupoJid, this.agora());
    if (!votacao) return { tipo: 'sem_votacao' };
    return this.registrar(votacao, avaliadorJid, estrelas, false);
  }

  public async registrarVotoEnquete(
    mensagemEnqueteId: string,
    avaliadorJid: string,
    opcoesSelecionadas: string[],
  ): Promise<ResultadoRegistroVoto> {
    const votacao = await this.repositorioVotacao.buscarPorMensagemEnquete(mensagemEnqueteId);
    if (!votacao || votacao.fechada || votacao.expiraEm <= this.agora())
      return { tipo: 'sem_votacao' };
    const estrelas = this.extrairEstrelas(opcoesSelecionadas[0] ?? '');
    if (!estrelas) return { tipo: 'invalido' };
    return this.registrar(votacao, avaliadorJid, estrelas, true);
  }

  public async fecharExpiradas(): Promise<
    Array<{ votacao: Votacao; resultado: ResultadoVotacao }>
  > {
    const expiradas = await this.repositorioVotacao.listarExpiradas(this.agora());
    const resultados: Array<{ votacao: Votacao; resultado: ResultadoVotacao }> = [];
    for (const votacao of expiradas) {
      const resultado = await this.fechar(votacao);
      if (resultado) resultados.push(resultado);
    }
    return resultados;
  }

  public async encerrarAtiva(grupoJid: string): Promise<ResultadoEncerramentoVotacao> {
    const votacao = await this.repositorioVotacao.buscarAtivaPorGrupo(grupoJid, this.agora());
    if (!votacao) return { tipo: 'sem_votacao' };
    const encerramento = await this.fechar(votacao);
    return encerramento ? { tipo: 'encerrada', ...encerramento } : { tipo: 'sem_votacao' };
  }

  private async registrar(
    votacao: Votacao,
    avaliadorJid: string,
    estrelas: number,
    permitirAtualizacao: boolean,
  ): Promise<ResultadoRegistroVoto> {
    const avaliador = await this.repositorioJogador.buscarPorJid(avaliadorJid);
    if (!avaliador) return { tipo: 'avaliador_desconhecido' };
    if (avaliador.id === votacao.jogador.id) return { tipo: 'autoavaliacao' };
    const registrado = await this.repositorioAvaliacao.registrar(
      votacao.id,
      avaliador.id,
      votacao.jogador.id,
      estrelas,
      permitirAtualizacao,
    );
    return registrado ? { tipo: 'registrado', votacao, estrelas } : { tipo: 'duplicado' };
  }

  private async fechar(
    votacao: Votacao,
  ): Promise<{ votacao: Votacao; resultado: ResultadoVotacao } | null> {
    const fechadaAgora = await this.repositorioVotacao.fechar(votacao.id);
    if (!fechadaAgora) return null;
    const consolidado = await this.repositorioAvaliacao.obterResultado(votacao.id);
    return {
      votacao: { ...votacao, fechada: true },
      resultado: {
        jogador: votacao.jogador,
        media: consolidado.media,
        totalVotos: consolidado.total,
      },
    };
  }

  private extrairEstrelas(opcao: string): number | null {
    const encontrado = opcao.match(/[1-5]/)?.[0];
    return encontrado ? Number(encontrado) : null;
  }
}
