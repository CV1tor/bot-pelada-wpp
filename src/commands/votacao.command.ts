import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';

export class VotacaoCommand implements Comando {
  public readonly nome = 'votacao';
  public readonly descricao = 'abre enquete para um jogador ou todos os confirmados (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    if (!nome || nome.toLocaleLowerCase('pt-BR') === 'todos') {
      return this.iniciarTodos(contexto.grupoJid);
    }

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

  private async iniciarTodos(grupoJid: string): Promise<string> {
    const resultado = await this.votacaoService.iniciarTodos(grupoJid);
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    if (resultado.tipo === 'sem_participantes') return 'Não há jogadores confirmados na lista.';

    const resumo = [`🗳️ ${resultado.abertas.length} enquete(s) aberta(s).`];
    if (resultado.existentes.length) {
      resumo.push(`⏳ ${resultado.existentes.length} já estava(m) ativa(s).`);
    }
    if (resultado.falhas.length) {
      resumo.push(
        `⚠️ Falha ao abrir ${resultado.falhas.length}: ${resultado.falhas
          .map(({ nome }) => nome)
          .join(', ')}.`,
      );
    }
    return resumo.join('\n');
  }
}
