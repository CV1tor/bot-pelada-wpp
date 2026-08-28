import type { Comando, ContextoComando } from '../models/types.js';
import type { SorteioService } from '../services/sorteio.service.js';

export class SorteioCommand implements Comando {
  public readonly nome = 'sorteio';
  public readonly descricao = 'sorteia times equilibrados (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly sorteioService: SorteioService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const quantidadeTimes = contexto.argumentos[0] ? Number(contexto.argumentos[0]) : 2;
    try {
      const times = await this.sorteioService.sortear(quantidadeTimes);
      const composicoes = times
        .map((time) => `Time ${time.numero}: ${time.jogadores.map(({ nome }) => nome).join(', ')}`)
        .join('\n');
      return `🏐 Times sorteados:\n${composicoes}`;
    } catch (erro) {
      return erro instanceof Error ? erro.message : 'Não foi possível sortear os times.';
    }
  }
}
