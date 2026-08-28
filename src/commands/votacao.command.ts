import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';

export class VotacaoCommand implements Comando {
  public readonly nome = 'votacao';
  public readonly descricao = 'abre uma enquete nativa para avaliar um jogador';

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    if (!nome) return 'Informe o jogador. Exemplo: !votacao João';
    const resultado = await this.votacaoService.iniciar(nome, contexto.grupoJid);
    if (resultado.tipo === 'nao_encontrado') return `Jogador “${nome}” não encontrado.`;
    if (resultado.tipo === 'ambiguo') {
      return `Encontrei mais de um jogador: ${resultado.nomes.join(', ')}. Seja mais específico.`;
    }
    if (resultado.tipo === 'ja_existe') {
      return `⏳ Já existe uma votação ativa para ${resultado.votacao.jogador.nome}.`;
    }
    const dataEHora = resultado.votacao.expiraEm.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Fortaleza',
    });
    return resultado.enqueteNativa
      ? `🗳️ Enquete aberta para ${resultado.votacao.jogador.nome} até ${dataEHora}. Se a enquete não funcionar, use !voto N.`
      : `⚠️ A enquete nativa não ficou disponível. Vote de 1 a 5 em ${resultado.votacao.jogador.nome} com !voto N até ${dataEHora}.`;
  }
}
