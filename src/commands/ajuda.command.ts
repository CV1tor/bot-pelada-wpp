import type { Comando } from '../models/types.js';

export class AjudaCommand implements Comando {
  public readonly nome = 'ajuda';
  public readonly descricao = 'lista os comandos disponíveis';

  public constructor(private readonly listarComandos: () => Comando[]) {}

  public executar(): Promise<string> {
    const linhas = this.listarComandos()
      .map((comando) => `!${comando.nome} — ${comando.descricao}`)
      .join('\n');
    return Promise.resolve(`🤖 Comandos disponíveis:\n${linhas}`);
  }
}
