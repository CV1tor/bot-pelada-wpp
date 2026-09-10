export interface Jogador {
  id: string;
  jid: string;
  nome: string;
}

export interface Participante extends Jogador {
  confirmadoEm: Date;
  canceladoEm: Date | null;
  presente: boolean;
  pagoEm: Date | null;
  valorPagoCentavos: number | null;
}

export interface JogadorAvaliado extends Jogador {
  media: number;
  totalAvaliacoes: number;
}

export interface SessaoAberta {
  id: string;
  data: Date;
  valorTotalCentavos: number;
  participantes: Participante[];
}

export interface SituacaoFinanceira {
  valorTotalCentavos: number;
  valorRecebidoCentavos: number;
  saldoCentavos: number;
  quantidadePendentes: number;
  valorIndividualCentavos: number;
}

export interface EstatisticasJogador {
  jogador: Jogador;
  peladasPresentes: number;
  rating: number | null;
  totalAvaliacoes: number;
  sequenciaAtual: number;
}

export interface ResumoMensal {
  competencia: string;
  quantidadePeladas: number;
  destaque: JogadorAvaliado | null;
}

export interface Votacao {
  id: string;
  grupoJid: string;
  sessaoId: string | null;
  jogador: Jogador;
  expiraEm: Date;
  fechada: boolean;
  pollMessageId: string | null;
  pollMessageSecret: string | null;
}

export interface ResultadoVotacao {
  jogador: Jogador;
  media: number | null;
  totalVotos: number;
}

export interface TimeSorteado {
  numero: number;
  jogadores: JogadorAvaliado[];
  pontuacao: number;
}

export interface ContextoComando {
  grupoJid: string;
  remetenteJid: string;
  remetenteNome: string;
  argumentos: string[];
  mencionados: string[];
}

export interface Comando {
  nome: string;
  descricao: string;
  restritoAAdministrador?: boolean;
  executar(contexto: ContextoComando): Promise<string>;
}

export interface EnqueteEnviada {
  mensagemId: string;
  segredo: string | null;
}

export interface ParticipanteGrupo {
  jid: string;
  papel: 'admin' | 'superadmin' | 'membro';
}

export interface AtualizacaoEnquete {
  grupoJid: string;
  remetenteJid: string;
  mensagemEnqueteId: string;
  opcoesSelecionadas: string[];
}
