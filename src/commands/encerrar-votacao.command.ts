import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';
import { formatarResultadoVotacao } from '../utils/formatar-resultado-votacao.js';

export class EncerrarVotacaoCommand implements Comando {
  public readonly nome = 'encerrar-votacao';
  public readonly descricao = 'encerra a votação ativa e publica o resultado (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const encerramento = await this.votacaoService.encerrarAtiva(contexto.grupoJid);
    return encerramento.tipo === 'encerrada'
      ? formatarResultadoVotacao(encerramento.resultado)
      : 'Não há votação ativa neste grupo.';
  }
}
