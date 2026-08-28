import { createHash } from 'node:crypto';
import type { AtualizacaoEnquete } from '../models/types.js';

export interface MensagemRecebida {
  grupoJid: string;
  remetenteJid: string;
  remetenteNome: string;
  texto: string;
  mencionados: string[];
  enviadaPeloBot: boolean;
}

export type EventoWebhookInterpretado =
  | { tipo: 'mensagem'; mensagem: MensagemRecebida }
  | { tipo: 'enquete'; atualizacoes: AtualizacaoEnquete[] }
  | { tipo: 'ignorado' };

type Registro = Record<string, unknown>;

const registro = (valor: unknown): Registro | null =>
  typeof valor === 'object' && valor !== null ? (valor as Registro) : null;

const objetoNoCaminho = (valor: unknown, caminho: string[]): Registro | null => {
  let atual: unknown = valor;
  for (const parte of caminho) atual = registro(atual)?.[parte];
  return registro(atual);
};

const valorNoCaminho = (valor: unknown, caminho: string[]): unknown => {
  let atual: unknown = valor;
  for (const parte of caminho) atual = registro(atual)?.[parte];
  return atual;
};

const textoNoCaminho = (valor: unknown, caminhos: string[][]): string => {
  for (const caminho of caminhos) {
    const resultado = valorNoCaminho(valor, caminho);
    if (typeof resultado === 'string') return resultado;
  }
  return '';
};

const textosNoCaminho = (valor: unknown, caminhos: string[][]): string[] => {
  for (const caminho of caminhos) {
    const resultado = valorNoCaminho(valor, caminho);
    if (Array.isArray(resultado))
      return resultado.filter((item): item is string => typeof item === 'string');
  }
  return [];
};

const interpretarMensagem = (corpo: unknown): EventoWebhookInterpretado => {
  const dados = objetoNoCaminho(corpo, ['data']);
  const chave = objetoNoCaminho(dados, ['key']);
  const mensagem = objetoNoCaminho(dados, ['message']);
  if (!dados || !chave || !mensagem) return { tipo: 'ignorado' };

  const grupoJid = typeof chave.remoteJid === 'string' ? chave.remoteJid : '';
  const remetenteJid =
    typeof chave.participant === 'string'
      ? chave.participant
      : typeof dados.participant === 'string'
        ? dados.participant
        : grupoJid;
  const texto = textoNoCaminho(mensagem, [
    ['conversation'],
    ['extendedTextMessage', 'text'],
    ['imageMessage', 'caption'],
    ['videoMessage', 'caption'],
  ]);
  const mencionados = textosNoCaminho(mensagem, [
    ['extendedTextMessage', 'contextInfo', 'mentionedJid'],
    ['contextInfo', 'mentionedJid'],
  ]);
  return {
    tipo: 'mensagem',
    mensagem: {
      grupoJid,
      remetenteJid,
      remetenteNome:
        typeof dados.pushName === 'string'
          ? dados.pushName
          : (remetenteJid.split('@')[0] ?? remetenteJid),
      texto,
      mencionados,
      enviadaPeloBot: chave.fromMe === true,
    },
  };
};

const opcoesEnquete = ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'];
const opcoesPorHash = new Map(
  opcoesEnquete.map((opcao) => [createHash('sha256').update(opcao).digest('hex'), opcao]),
);

const extrairBytes = (valor: unknown): number[] => {
  if (Array.isArray(valor) && valor.every((item) => typeof item === 'number')) return valor;
  const item = registro(valor);
  if (!item) return [];
  if (Array.isArray(item.data) && item.data.every((byte) => typeof byte === 'number')) {
    return item.data;
  }
  return Object.entries(item)
    .filter(([chave, byte]) => /^\d+$/.test(chave) && typeof byte === 'number')
    .sort(([primeiro], [segundo]) => Number(primeiro) - Number(segundo))
    .map(([, byte]) => byte as number);
};

const normalizarOpcoes = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((opcao) => {
    if (typeof opcao === 'string') return [opcao];
    if (typeof opcao === 'number') return [String(opcao)];
    const item = registro(opcao);
    const nome = item?.name ?? item?.optionName ?? item?.value;
    if (typeof nome === 'string') return [nome];
    const bytes = extrairBytes(opcao);
    const opcaoMapeada = bytes.length
      ? opcoesPorHash.get(Buffer.from(bytes).toString('hex'))
      : null;
    return opcaoMapeada ? [opcaoMapeada] : [];
  });
};

const interpretarEnquete = (corpo: unknown): EventoWebhookInterpretado => {
  const dados = objetoNoCaminho(corpo, ['data']);
  if (!dados) return { tipo: 'ignorado' };
  const chave = objetoNoCaminho(dados, ['key']);
  const grupoJid = textoNoCaminho(chave, [['remoteJid']]);
  const remetentePadrao = textoNoCaminho(chave, [['participant'], ['remoteJid']]);
  const fontes = [
    valorNoCaminho(dados, ['update', 'pollUpdates']),
    valorNoCaminho(dados, ['pollUpdates']),
    valorNoCaminho(dados, ['message', 'pollUpdateMessage']),
    valorNoCaminho(dados, ['pollUpdate']),
  ];
  const itens = fontes.find(Array.isArray) ?? fontes.find((fonte) => registro(fonte));
  const atualizacoesBrutas = Array.isArray(itens) ? itens : itens ? [itens] : [];
  const atualizacoes = atualizacoesBrutas.flatMap((item): AtualizacaoEnquete[] => {
    const mensagemEnqueteId = textoNoCaminho(item, [
      ['pollUpdateMessageKey', 'id'],
      ['pollCreationMessageKey', 'id'],
      ['pollMessageId'],
      ['messageId'],
    ]);
    const remetenteJid =
      textoNoCaminho(item, [['voterJid'], ['participant'], ['key', 'participant']]) ||
      remetentePadrao;
    const opcoes = normalizarOpcoes(
      valorNoCaminho(item, ['vote', 'selectedOptions']) ??
        valorNoCaminho(item, ['selectedOptions']) ??
        valorNoCaminho(item, ['options']),
    );
    return mensagemEnqueteId && remetenteJid
      ? [{ grupoJid, remetenteJid, mensagemEnqueteId, opcoesSelecionadas: opcoes }]
      : [];
  });
  return atualizacoes.length ? { tipo: 'enquete', atualizacoes } : { tipo: 'ignorado' };
};

export const interpretarEventoWebhook = (corpo: unknown): EventoWebhookInterpretado => {
  const evento = textoNoCaminho(corpo, [['event']])
    .toLocaleLowerCase('en-US')
    .replaceAll('_', '.');
  if (evento.includes('messages.upsert')) return interpretarMensagem(corpo);
  if (evento.includes('poll') || evento.includes('messages.update'))
    return interpretarEnquete(corpo);
  return { tipo: 'ignorado' };
};
