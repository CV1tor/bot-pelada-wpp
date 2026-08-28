import { vi } from 'vitest';
import type { ClienteEvolutionApi } from '../src/integrations/evolution-api.client.js';
import type { ContextoComando, Jogador, Votacao } from '../src/models/types.js';
import type { RepositorioAvaliacao } from '../src/repositories/avaliacao.repository.js';
import type { RepositorioJogador } from '../src/repositories/player.repository.js';
import type { RepositorioSessao } from '../src/repositories/sessao.repository.js';
import type { RepositorioVotacao } from '../src/repositories/votacao.repository.js';

export const jogador = (id = 'jogador-1', nome = 'João', jid = '5511@s.whatsapp.net'): Jogador => ({
  id,
  nome,
  jid,
});

export const votacao = (): Votacao => ({
  id: 'votacao-1',
  grupoJid: 'grupo@g.us',
  jogador: jogador(),
  expiraEm: new Date('2026-08-28T13:10:00.000Z'),
  fechada: false,
  pollMessageId: null,
  pollMessageSecret: null,
});

export const contexto: ContextoComando = {
  grupoJid: 'grupo@g.us',
  remetenteJid: '5522@s.whatsapp.net',
  remetenteNome: 'Maria',
  argumentos: [],
  mencionados: [],
};

export const criarClienteEvolutionMock = (): ClienteEvolutionApi => ({
  enviarTexto: vi.fn<ClienteEvolutionApi['enviarTexto']>(),
  enviarEnquete: vi.fn<ClienteEvolutionApi['enviarEnquete']>(),
  obterParticipantesGrupo: vi.fn<ClienteEvolutionApi['obterParticipantesGrupo']>(),
});

export const criarRepositorioJogadorMock = (): RepositorioJogador => ({
  salvar: vi.fn<RepositorioJogador['salvar']>(),
  salvarAvulso: vi.fn<RepositorioJogador['salvarAvulso']>(),
  buscarPorJid: vi.fn<RepositorioJogador['buscarPorJid']>(),
  listar: vi.fn<RepositorioJogador['listar']>(),
});

export const criarRepositorioSessaoMock = (): RepositorioSessao => ({
  obterOuCriarAberta: vi.fn<RepositorioSessao['obterOuCriarAberta']>(),
  adicionarParticipante: vi.fn<RepositorioSessao['adicionarParticipante']>(),
  removerParticipante: vi.fn<RepositorioSessao['removerParticipante']>(),
  limparParticipantes: vi.fn<RepositorioSessao['limparParticipantes']>(),
  listarParticipantesAvaliados: vi.fn<RepositorioSessao['listarParticipantesAvaliados']>(),
  substituirTimes: vi.fn<RepositorioSessao['substituirTimes']>(),
});

export const criarRepositorioAvaliacaoMock = (): RepositorioAvaliacao => ({
  registrar: vi.fn<RepositorioAvaliacao['registrar']>(),
  obterResultado: vi.fn<RepositorioAvaliacao['obterResultado']>(),
  listarRanking: vi.fn<RepositorioAvaliacao['listarRanking']>(),
});

export const criarRepositorioVotacaoMock = (): RepositorioVotacao => ({
  criar: vi.fn<RepositorioVotacao['criar']>(),
  vincularEnquete: vi.fn<RepositorioVotacao['vincularEnquete']>(),
  buscarAtivaPorGrupo: vi.fn<RepositorioVotacao['buscarAtivaPorGrupo']>(),
  buscarPorMensagemEnquete: vi.fn<RepositorioVotacao['buscarPorMensagemEnquete']>(),
  listarExpiradas: vi.fn<RepositorioVotacao['listarExpiradas']>(),
  fechar: vi.fn<RepositorioVotacao['fechar']>(),
});
