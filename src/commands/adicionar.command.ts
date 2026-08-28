import type { Comando, ContextoComando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';

export class AdicionarCommand implements Comando {
  public readonly nome = 'adicionar';
  public readonly descricao = 'adiciona você, um contato mencionado ou um nome à lista';

  public constructor(private readonly listaService: ListaService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const mencionado = contexto.mencionados[0];
    const nomeAvulso = contexto.argumentos.join(' ');
    const resultado = mencionado
      ? await this.listaService.adicionarMencionado(mencionado)
      : nomeAvulso
        ? await this.listaService.adicionarAvulso(nomeAvulso)
        : await this.listaService.adicionar(contexto.remetenteJid, contexto.remetenteNome);
    return resultado.adicionado
      ? `✅ ${resultado.jogador.nome} foi adicionado à lista.`
      : `ℹ️ ${resultado.jogador.nome} já está na lista.`;
  }
}
