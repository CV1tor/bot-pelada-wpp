import type { Comando, ContextoComando } from '../models/types.js';
import type { SessaoService } from '../services/sessao.service.js';
import { formatarMoeda } from '../utils/formatacao.js';

export class PagueiCommand implements Comando {
  public readonly nome = 'paguei';
  public readonly descricao = 'confirma o pagamento próprio ou de um participante pelo nome';

  public constructor(private readonly sessaoService: SessaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const nome = contexto.argumentos.join(' ');
    const resultado = await this.sessaoService.pagar(contexto.remetenteJid, nome);
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    if (resultado.tipo === 'nao_encontrado') {
      return `Nenhum participante confirmado encontrado para “${nome}”.`;
    }
    if (resultado.tipo === 'ambiguo') {
      return `Encontrei mais de uma pessoa: ${resultado.jogadores.map((jogador) => jogador.nome).join(', ')}. Seja mais específico.`;
    }
    if (resultado.tipo === 'jogador_desconhecido' || resultado.tipo === 'nao_confirmado') {
      return 'Confirme sua presença com !confirmar antes de registrar o pagamento.';
    }
    if (resultado.tipo === 'ja_pago') {
      const titular = nome ? `O pagamento de ${resultado.jogador.nome}` : 'Seu pagamento';
      return `ℹ️ ${titular} de ${formatarMoeda(resultado.valorPagoCentavos)} já estava registrado.`;
    }
    const titular = nome ? ` de ${resultado.jogador.nome}` : '';
    return `✅ Pagamento${titular} de ${formatarMoeda(resultado.valorPagoCentavos)} registrado.\n⏳ Saldo pendente: ${formatarMoeda(resultado.situacao.saldoCentavos)}`;
  }
}
