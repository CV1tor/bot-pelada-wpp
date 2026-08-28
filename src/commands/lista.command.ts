import type { Comando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';

export class ListaCommand implements Comando {
  public readonly nome = 'lista';
  public readonly descricao = 'mostra os participantes confirmados';

  public constructor(private readonly listaService: ListaService) {}

  public async executar(): Promise<string> {
    const sessao = await this.listaService.obterLista();
    if (!sessao.participantes.length) return '📋 A lista da pelada está vazia.';
    const nomes = sessao.participantes
      .map(({ nome }, indice) => `${indice + 1}. ${nome}`)
      .join('\n');
    return `📋 Lista da pelada (${sessao.participantes.length} confirmados):\n${nomes}`;
  }
}
