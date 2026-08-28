import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import type { Comando, ContextoComando } from '../models/types.js';
import { ehAdministradorDoGrupo } from '../utils/permissions.js';

export interface ComandoInterpretado {
  nome: string;
  argumentos: string[];
}

export const interpretarComando = (texto: string): ComandoInterpretado | null => {
  const conteudo = texto.trim();
  if (!conteudo.startsWith('!')) return null;
  const partes = conteudo.slice(1).split(/\s+/).filter(Boolean);
  const nome = partes.shift()?.toLocaleLowerCase('pt-BR');
  return nome ? { nome, argumentos: partes } : null;
};

export class DispatcherComandos {
  private readonly comandos = new Map<string, Comando>();

  public constructor(private readonly clienteEvolution: ClienteEvolutionApi) {}

  public registrar(...comandos: Comando[]): void {
    for (const comando of comandos) this.comandos.set(comando.nome, comando);
  }

  public listar(): Comando[] {
    return [...this.comandos.values()].sort((primeiro, segundo) =>
      primeiro.nome.localeCompare(segundo.nome),
    );
  }

  public async despachar(
    texto: string,
    contextoBase: Omit<ContextoComando, 'argumentos'>,
  ): Promise<string | null> {
    const interpretado = interpretarComando(texto);
    if (!interpretado) return null;
    const comando = this.comandos.get(interpretado.nome);
    if (!comando) return `Comando !${interpretado.nome} não reconhecido. Use !ajuda.`;
    if (
      comando.restritoAAdministrador &&
      !(await ehAdministradorDoGrupo(
        this.clienteEvolution,
        contextoBase.grupoJid,
        contextoBase.remetenteJid,
      ))
    ) {
      return '⛔ Este comando só pode ser usado por administradores do grupo.';
    }
    return comando.executar({ ...contextoBase, argumentos: interpretado.argumentos });
  }
}
