import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';

export class VotacaoCommand implements Comando {
  public readonly nome = 'votacao';
  public readonly descricao = 'abre uma enquete nativa para avaliar um jogador (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    if (!nome) return 'Informe o jogador. Exemplo: !votacao João';
    const resultado = await this.votacaoService.iniciar(nome, contexto.grupoJid);
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    if (resultado.tipo === 'nao_encontrado') return `Jogador “${nome}” não encontrado.`;
    if (resultado.tipo === 'ambiguo') {
      return `Encontrei mais de um jogador: ${resultado.nomes.join(', ')}. Seja mais específico.`;
    }
    if (resultado.tipo === 'ja_existe') {
      return `⏳ Já existe uma votação ativa para ${resultado.votacao.jogador.nome}.`;
    }
    if (resultado.tipo === 'falha_enquete') {
      return '⚠️ Não foi possível abrir a enquete nativa. Tente novamente mais tarde.';
    }
    const dataEHora = resultado.votacao.expiraEm.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Fortaleza',
    });
    return `🗳️ Enquete aberta para ${resultado.votacao.jogador.nome} até ${dataEHora}. Vote diretamente na enquete do WhatsApp.`;
  }
}
