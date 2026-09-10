import type { Comando, ContextoComando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';

export class ConfirmarCommand implements Comando {
  public readonly nome = 'confirmar';
  public readonly descricao = 'confirma sua presença na pelada aberta';

  public constructor(private readonly listaService: ListaService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const resultado = await this.listaService.adicionar(
      contexto.remetenteJid,
      contexto.remetenteNome,
    );
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    return resultado.tipo === 'adicionado'
      ? `✅ ${resultado.jogador.nome} confirmou presença.`
      : `ℹ️ ${resultado.jogador.nome} já está confirmado.`;
  }
}
