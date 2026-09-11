import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';
import { formatarResultadoVotacao } from '../utils/formatar-resultado-votacao.js';

export class EncerrarVotacaoCommand implements Comando {
  public readonly nome = 'encerrar-votacao';
  public readonly descricao = 'encerra a votação de um jogador ou todas as ativas (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    if (!nome || nome.toLocaleLowerCase('pt-BR') === 'todas') {
      return this.encerrarTodas(contexto.grupoJid);
    }

    const encerramento = await this.votacaoService.encerrarAtiva(nome, contexto.grupoJid);
    if (encerramento.tipo === 'ambiguo') {
      return `Encontrei mais de uma votação: ${encerramento.nomes.join(', ')}. Seja mais específico.`;
    }
    return encerramento.tipo === 'encerrada'
      ? formatarResultadoVotacao(encerramento.resultado)
      : `Não há votação ativa para “${nome}”.`;
  }

  private async encerrarTodas(grupoJid: string): Promise<string> {
    const encerramento = await this.votacaoService.encerrarTodasAtivas(grupoJid);
    if (encerramento.tipo === 'sem_votacao') return 'Não há votações ativas.';

    const resultados = encerramento.resultados.map(({ resultado }) =>
      formatarResultadoVotacao(resultado),
    );
    if (encerramento.ignoradas) {
      resultados.push(`ℹ️ ${encerramento.ignoradas} votação(ões) já havia(m) sido encerrada(s).`);
    }
    return resultados.join('\n');
  }
}
