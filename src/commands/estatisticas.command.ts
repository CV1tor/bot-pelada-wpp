import type { Comando, ContextoComando } from '../models/types.js';
import type { EstatisticasService } from '../services/estatisticas.service.js';

export class EstatisticasCommand implements Comando {
  public readonly nome = 'estatisticas';
  public readonly descricao = 'mostra presenças, rating e sequência de um jogador';

  public constructor(private readonly estatisticasService: EstatisticasService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const resultado = await this.estatisticasService.obter(
      contexto.remetenteJid,
      contexto.argumentos.join(' '),
      contexto.mencionados[0],
    );
    if (resultado.tipo === 'nao_encontrado') return 'Jogador não encontrado.';
    if (resultado.tipo === 'ambiguo') {
      return `Encontrei mais de um jogador: ${resultado.nomes.join(', ')}. Seja mais específico.`;
    }
    const { jogador, peladasPresentes, rating, totalAvaliacoes, sequenciaAtual } =
      resultado.estatisticas;
    const linhaRating =
      rating === null
        ? 'Ainda não avaliado'
        : `${rating.toFixed(1)} (${totalAvaliacoes} avaliações)`;
    return `📊 Estatísticas de ${jogador.nome}\n\n🏐 Peladas presentes: ${peladasPresentes}\n⭐ Rating: ${linhaRating}\n🔥 Sequência atual: ${sequenciaAtual} pelada(s)`;
  }
}
