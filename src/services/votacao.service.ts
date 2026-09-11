import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import type { Jogador, ResultadoVotacao, SessaoAberta, Votacao } from '../models/types.js';
import type { RepositorioAvaliacao } from '../repositories/avaliacao.repository.js';
import type { RepositorioJogador } from '../repositories/player.repository.js';
import type { RepositorioVotacao } from '../repositories/votacao.repository.js';
import type { RepositorioSessao } from '../repositories/sessao.repository.js';
import { resolverJogadorPorNome } from '../utils/resolver-jogador.js';

export type ResultadoInicioVotacao =
  | { tipo: 'aberta'; votacao: Votacao }
  | { tipo: 'falha_enquete' }
  | { tipo: 'ja_existe'; votacao: Votacao }
  | { tipo: 'sem_sessao' }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ambiguo'; nomes: string[] };

export type ResultadoInicioVotacoes =
  | {
      tipo: 'processada';
      abertas: Votacao[];
      existentes: Votacao[];
      falhas: Jogador[];
    }
  | { tipo: 'sem_sessao' }
  | { tipo: 'sem_participantes' };

export type ResultadoRegistroVoto =
  | { tipo: 'registrado'; votacao: Votacao; estrelas: number }
  | { tipo: 'sem_votacao' }
  | { tipo: 'invalido' }
  | { tipo: 'autoavaliacao' }
  | { tipo: 'duplicado' }
  | { tipo: 'avaliador_desconhecido' };

export type ResultadoEncerramentoVotacao =
  | { tipo: 'encerrada'; votacao: Votacao; resultado: ResultadoVotacao }
  | { tipo: 'sem_votacao' }
  | { tipo: 'ambiguo'; nomes: string[] };

const OPCOES_ENQUETE = ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'];
const DURACAO_VOTACAO_EM_MILISSEGUNDOS = 24 * 60 * 60 * 1000;

export class VotacaoService {
  public constructor(
    private readonly repositorioJogador: RepositorioJogador,
    private readonly repositorioVotacao: RepositorioVotacao,
    private readonly repositorioAvaliacao: RepositorioAvaliacao,
    private readonly clienteEvolution: ClienteEvolutionApi,
    private readonly repositorioSessao: RepositorioSessao,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  public async iniciar(nome: string, grupoJid: string): Promise<ResultadoInicioVotacao> {
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };

    const resolucao = resolverJogadorPorNome(sessao.participantes, nome);
    if (resolucao.tipo === 'nao_encontrado') return { tipo: 'nao_encontrado' };
    if (resolucao.tipo === 'ambiguo') {
      return {
        tipo: 'ambiguo',
        nomes: resolucao.jogadores.map(({ nome: nomeJogador }) => nomeJogador),
      };
    }

    return this.iniciarParaJogador(resolucao.jogador, sessao, grupoJid);
  }

  public async iniciarTodos(grupoJid: string): Promise<ResultadoInicioVotacoes> {
    const sessao = await this.repositorioSessao.buscarAberta();
    if (!sessao) return { tipo: 'sem_sessao' };
    if (!sessao.participantes.length) return { tipo: 'sem_participantes' };

    const resultado: Extract<ResultadoInicioVotacoes, { tipo: 'processada' }> = {
      tipo: 'processada',
      abertas: [],
      existentes: [],
      falhas: [],
    };

    for (const participante of sessao.participantes) {
      const inicio = await this.iniciarParaJogador(participante, sessao, grupoJid);
      if (inicio.tipo === 'aberta') resultado.abertas.push(inicio.votacao);
      if (inicio.tipo === 'ja_existe') resultado.existentes.push(inicio.votacao);
      if (inicio.tipo === 'falha_enquete') resultado.falhas.push(participante);
    }

    return resultado;
  }

  private async iniciarParaJogador(
    jogador: Jogador,
    sessao: SessaoAberta,
    grupoJid: string,
  ): Promise<Extract<ResultadoInicioVotacao, { tipo: 'aberta' | 'falha_enquete' | 'ja_existe' }>> {
    const ativa = await this.repositorioVotacao.buscarAtivaPorJogadorNaSessao(
      jogador.id,
      sessao.id,
      this.agora(),
    );
    if (ativa) return { tipo: 'ja_existe', votacao: ativa };

    const expiraEm = new Date(this.agora().getTime() + DURACAO_VOTACAO_EM_MILISSEGUNDOS);
    const votacao = await this.repositorioVotacao.criar(jogador.id, grupoJid, sessao.id, expiraEm);
    if (!votacao) {
      const criadaConcorrentemente = await this.repositorioVotacao.buscarAtivaPorJogadorNaSessao(
        jogador.id,
        sessao.id,
        this.agora(),
      );
      if (criadaConcorrentemente) return { tipo: 'ja_existe', votacao: criadaConcorrentemente };
      throw new Error('Não foi possível recuperar a votação criada concorrentemente');
    }
    try {
      const enquete = await this.clienteEvolution.enviarEnquete(
        grupoJid,
        `Avaliação de ${jogador.nome}`,
        OPCOES_ENQUETE,
        1,
      );
      await this.repositorioVotacao.vincularEnquete(
        votacao.id,
        enquete.mensagemId,
        enquete.segredo,
      );
      return {
        tipo: 'aberta',
        votacao: {
          ...votacao,
          pollMessageId: enquete.mensagemId,
          pollMessageSecret: enquete.segredo,
        },
      };
    } catch {
      await this.repositorioVotacao.fechar(votacao.id);
      return { tipo: 'falha_enquete' };
    }
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

  public async encerrarAtiva(
    nome: string,
    grupoJid: string,
  ): Promise<ResultadoEncerramentoVotacao> {
    const votacoes = await this.repositorioVotacao.listarAtivasPorGrupo(grupoJid, this.agora());
    const resolucao = resolverJogadorPorNome(
      votacoes.map(({ jogador }) => jogador),
      nome,
    );
    if (resolucao.tipo === 'nao_encontrado') return { tipo: 'sem_votacao' };
    if (resolucao.tipo === 'ambiguo') {
      return {
        tipo: 'ambiguo',
        nomes: resolucao.jogadores.map(({ nome: nomeJogador }) => nomeJogador),
      };
    }
    const votacao = votacoes.find(({ jogador }) => jogador.id === resolucao.jogador.id);
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
