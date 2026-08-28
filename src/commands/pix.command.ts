import type { Comando } from '../models/types.js';

export class PixCommand implements Comando {
  public readonly nome = 'pix';
  public readonly descricao = 'mostra a chave Pix da pelada';

  public constructor(
    private readonly chavePix: string,
    private readonly nomePix: string,
  ) {}

  public executar(): Promise<string> {
    return Promise.resolve(`💸 Pix: ${this.chavePix}\nTitular: ${this.nomePix}`);
  }
}
