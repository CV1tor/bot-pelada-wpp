import type { Comando, ContextoComando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';

export class LimparCommand implements Comando {
  public readonly nome = 'limpar';
  public readonly descricao = 'limpa a lista atual após confirmação (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly listaService: ListaService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    if (contexto.argumentos[0]?.toLocaleLowerCase('pt-BR') !== 'confirmar') {
      return '⚠️ Para limpar a lista, responda com !limpar confirmar.';
    }
    const removidos = await this.listaService.limpar();
    return `🧹 Lista limpa. ${removidos} participante(s) removido(s).`;
  }
}
