import type { Comando, ContextoComando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';

export class RemoverCommand implements Comando {
  public readonly nome = 'remover';
  public readonly descricao = 'remove um participante pelo nome (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly listaService: ListaService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    if (!nome) return 'Informe quem deve ser removido. Exemplo: !remover Maria';
    const resultado = await this.listaService.remover(nome);
    if (resultado.tipo === 'nao_encontrado')
      return `Nenhum participante encontrado para “${nome}”.`;
    if (resultado.tipo === 'ambiguo') {
      return `Encontrei mais de uma pessoa: ${resultado.jogadores.map((jogador) => jogador.nome).join(', ')}. Seja mais específico.`;
    }
    return `✅ ${resultado.jogador.nome} foi removido da lista.`;
  }
}
