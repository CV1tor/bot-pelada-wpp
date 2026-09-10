import type { Comando, ContextoComando } from '../models/types.js';
import type { SessaoService } from '../services/sessao.service.js';
import { formatarMoeda } from '../utils/formatacao.js';

export class PagueiCommand implements Comando {
  public readonly nome = 'paguei';
  public readonly descricao = 'confirma seu pagamento e atualiza o saldo da pelada';

  public constructor(private readonly sessaoService: SessaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const resultado = await this.sessaoService.pagar(contexto.remetenteJid);
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    if (resultado.tipo === 'jogador_desconhecido' || resultado.tipo === 'nao_confirmado') {
      return 'Confirme sua presença com !confirmar antes de registrar o pagamento.';
    }
    if (resultado.tipo === 'ja_pago') {
      return `ℹ️ Seu pagamento de ${formatarMoeda(resultado.valorPagoCentavos)} já estava registrado.`;
    }
    return `✅ Pagamento de ${formatarMoeda(resultado.valorPagoCentavos)} registrado.\n⏳ Saldo pendente: ${formatarMoeda(resultado.situacao.saldoCentavos)}`;
  }
}
