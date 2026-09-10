import type { Comando, ContextoComando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';

export class SairCommand implements Comando {
  public readonly nome = 'sair';
  public readonly descricao = 'retira sua confirmação da pelada aberta';

  public constructor(private readonly listaService: ListaService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const resultado = await this.listaService.sair(contexto.remetenteJid);
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    if (resultado.tipo === 'nao_confirmado') return 'Você não está confirmado nesta pelada.';
    return `✅ ${resultado.jogador.nome} saiu da lista.`;
  }
}
