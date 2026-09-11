import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';
import { formatarResultadoVotacao } from '../utils/formatar-resultado-votacao.js';

export class EncerrarVotacaoCommand implements Comando {
  public readonly nome = 'encerrar-votacao';
  public readonly descricao = 'encerra a votação de um jogador e publica o resultado (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    if (!nome) return 'Informe o jogador. Exemplo: !encerrar-votacao João';
    const encerramento = await this.votacaoService.encerrarAtiva(nome, contexto.grupoJid);
    if (encerramento.tipo === 'ambiguo') {
      return `Encontrei mais de uma votação: ${encerramento.nomes.join(', ')}. Seja mais específico.`;
    }
    return encerramento.tipo === 'encerrada'
      ? formatarResultadoVotacao(encerramento.resultado)
      : `Não há votação ativa para “${nome}”.`;
  }
}
