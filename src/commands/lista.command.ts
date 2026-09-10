import type { Comando } from '../models/types.js';
import type { ListaService } from '../services/lista.service.js';
import { formatarDataHora, formatarMoeda } from '../utils/formatacao.js';

export class ListaCommand implements Comando {
  public readonly nome = 'lista';
  public readonly descricao = 'mostra data, participantes, pagamentos e saldo da pelada';

  public constructor(private readonly listaService: ListaService) {}

  public async executar(): Promise<string> {
    const sessao = await this.listaService.obterLista();
    if (!sessao) return '📋 Não há uma pelada aberta.';
    const situacao = await this.listaService.obterSituacaoFinanceira(sessao.id);
    const cabecalho = `🏐 Pelada de ${formatarDataHora(sessao.data)}\n💰 Total: ${formatarMoeda(sessao.valorTotalCentavos)}`;
    if (!sessao.participantes.length) return `${cabecalho}\n\n📋 A lista está vazia.`;
    const nomes = sessao.participantes
      .map(
        ({ nome, pagoEm }, indice) =>
          `${indice + 1}. ${nome} ${pagoEm ? '✅ Pago' : '⏳ Pendente'}`,
      )
      .join('\n');
    const parcela = situacao.quantidadePendentes
      ? `\n💵 Parcela atual: ${formatarMoeda(situacao.valorIndividualCentavos)}\n⏳ Saldo: ${formatarMoeda(situacao.saldoCentavos)}`
      : `\n✅ Pagamento total concluído.`;
    return `${cabecalho}\n\n📋 Confirmados (${sessao.participantes.length}):\n${nomes}${parcela}`;
  }
}
