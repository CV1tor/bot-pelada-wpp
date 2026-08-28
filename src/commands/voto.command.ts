import type { Comando, ContextoComando } from '../models/types.js';
import type { VotacaoService } from '../services/votacao.service.js';

export class VotoCommand implements Comando {
  public readonly nome = 'voto';
  public readonly descricao = 'fallback: registra um voto de 1 a 5';

  public constructor(private readonly votacaoService: VotacaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const estrelas = Number(contexto.argumentos[0]);
    const resultado = await this.votacaoService.registrarVotoTexto(
      contexto.grupoJid,
      contexto.remetenteJid,
      estrelas,
    );
    const mensagens = {
      sem_votacao: 'Não há votação ativa neste grupo.',
      invalido: 'O voto deve ser um número inteiro de 1 a 5.',
      autoavaliacao: 'Você não pode votar em si mesmo.',
      duplicado: 'Você já votou nesta votação.',
      avaliador_desconhecido: 'Entre na lista com !adicionar antes de votar.',
    } as const;
    return resultado.tipo === 'registrado'
      ? `✅ Voto de ${resultado.estrelas} ⭐ registrado para ${resultado.votacao.jogador.nome}.`
      : mensagens[resultado.tipo];
  }
}
