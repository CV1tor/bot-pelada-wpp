import type { EnqueteEnviada, ParticipanteGrupo } from '../models/types.js';

export interface ClienteEvolutionApi {
  enviarTexto(grupoJid: string, texto: string, mencoes?: string[]): Promise<void>;
  enviarEnquete(
    grupoJid: string,
    titulo: string,
    opcoes: string[],
    quantidadeSelecionavel: number,
  ): Promise<EnqueteEnviada>;
  obterParticipantesGrupo(grupoJid: string): Promise<ParticipanteGrupo[]>;
}

export interface OpcoesClienteEvolutionApi {
  urlBase: string;
  chaveApi: string;
  instancia: string;
  requisicao?: typeof fetch;
}

type RegistroDesconhecido = Record<string, unknown>;

const ehRegistro = (valor: unknown): valor is RegistroDesconhecido =>
  typeof valor === 'object' && valor !== null;

const lerCaminho = (valor: unknown, caminho: string[]): unknown => {
  let atual = valor;
  for (const chave of caminho) {
    if (!ehRegistro(atual)) return undefined;
    atual = atual[chave];
  }
  return atual;
};

const primeiroTexto = (valor: unknown, caminhos: string[][]): string | null => {
  for (const caminho of caminhos) {
    const encontrado = lerCaminho(valor, caminho);
    if (typeof encontrado === 'string' && encontrado) return encontrado;
  }
  return null;
};

const primeiroValor = (valor: unknown, caminhos: string[][]): unknown => {
  for (const caminho of caminhos) {
    const encontrado = lerCaminho(valor, caminho);
    if (encontrado !== undefined && encontrado !== null) return encontrado;
  }
  return null;
};

const serializarSegredo = (segredo: unknown): string | null => {
  if (typeof segredo === 'string') return segredo;
  if (Array.isArray(segredo) && segredo.every((item) => typeof item === 'number')) {
    return Buffer.from(segredo).toString('base64');
  }
  if (ehRegistro(segredo)) {
    const dados = segredo.data;
    if (Array.isArray(dados) && dados.every((item) => typeof item === 'number')) {
      return Buffer.from(dados).toString('base64');
    }
    const bytes = Object.entries(segredo)
      .filter(([chave, valor]) => /^\d+$/.test(chave) && typeof valor === 'number')
      .sort(([primeiro], [segundo]) => Number(primeiro) - Number(segundo))
      .map(([, valor]) => valor as number);
    if (bytes.length) return Buffer.from(bytes).toString('base64');
  }
  return null;
};

export class EvolutionApiClient implements ClienteEvolutionApi {
  private readonly requisicao: typeof fetch;

  public constructor(private readonly opcoes: OpcoesClienteEvolutionApi) {
    this.requisicao = opcoes.requisicao ?? fetch;
  }

  public async enviarTexto(grupoJid: string, texto: string, mencoes: string[] = []): Promise<void> {
    await this.executar(`/message/sendText/${this.opcoes.instancia}`, {
      number: grupoJid,
      text: texto,
      ...(mencoes.length ? { mentionsEveryOne: false, mentioned: mencoes } : {}),
    });
  }

  public async enviarEnquete(
    grupoJid: string,
    titulo: string,
    opcoes: string[],
    quantidadeSelecionavel: number,
  ): Promise<EnqueteEnviada> {
    const resposta = await this.executar(`/message/sendPoll/${this.opcoes.instancia}`, {
      number: grupoJid,
      name: titulo,
      selectableCount: quantidadeSelecionavel,
      values: opcoes,
    });
    const mensagemId = primeiroTexto(resposta, [
      ['key', 'id'],
      ['data', 'key', 'id'],
      ['messageId'],
      ['id'],
    ]);
    if (!mensagemId) throw new Error('A Evolution API não retornou o ID da enquete');

    const segredo = serializarSegredo(
      primeiroValor(resposta, [
        ['message', 'messageContextInfo', 'messageSecret'],
        ['data', 'message', 'messageContextInfo', 'messageSecret'],
        ['messageSecret'],
      ]),
    );
    return { mensagemId, segredo };
  }

  public async obterParticipantesGrupo(grupoJid: string): Promise<ParticipanteGrupo[]> {
    const parametros = new URLSearchParams({ groupJid: grupoJid });
    const resposta = await this.executar(
      `/group/participants/${this.opcoes.instancia}?${parametros.toString()}`,
      undefined,
      'GET',
    );
    const candidatos = Array.isArray(resposta)
      ? resposta
      : (lerCaminho(resposta, ['participants']) ?? lerCaminho(resposta, ['data', 'participants']));
    if (!Array.isArray(candidatos)) return [];

    return candidatos.flatMap((participante) => {
      if (!ehRegistro(participante)) return [];
      const jid = primeiroTexto(participante, [['id'], ['jid'], ['participant']]);
      if (!jid) return [];
      const papelOriginal = participante.admin ?? participante.role;
      const papel =
        papelOriginal === 'superadmin' || papelOriginal === 'super_admin'
          ? 'superadmin'
          : papelOriginal === 'admin'
            ? 'admin'
            : 'membro';
      return [{ jid, papel } satisfies ParticipanteGrupo];
    });
  }

  private async executar(
    caminho: string,
    corpo?: unknown,
    metodo: 'GET' | 'POST' = 'POST',
  ): Promise<unknown> {
    const resposta = await this.requisicao(`${this.opcoes.urlBase}${caminho}`, {
      method: metodo,
      headers: {
        apikey: this.opcoes.chaveApi,
        ...(corpo ? { 'content-type': 'application/json' } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Evolution API respondeu ${resposta.status}: ${detalhe}`);
    }
    if (resposta.status === 204) return null;
    return resposta.json() as Promise<unknown>;
  }
}
