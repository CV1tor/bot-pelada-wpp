import type { Comando, ContextoComando } from '../models/types.js';
import type { SessaoService } from '../services/sessao.service.js';
import { formatarMoeda } from '../utils/formatacao.js';

export class EncerrarPeladaCommand implements Comando {
  public readonly nome = 'encerrar-pelada';
  public readonly descricao = 'consolida as presenças: !encerrar-pelada confirmar (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly sessaoService: SessaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    if (contexto.argumentos[0]?.toLocaleLowerCase('pt-BR') !== 'confirmar') {
      return '⚠️ Para encerrar a pelada, responda com !encerrar-pelada confirmar.';
    }
    const resultado = await this.sessaoService.encerrar();
    if (resultado.tipo === 'sem_sessao') return 'Não há uma pelada aberta.';
    return `🏁 Pelada encerrada com ${resultado.quantidadePresentes} presença(s).\n💰 Recebido: ${formatarMoeda(resultado.situacao.valorRecebidoCentavos)}\n⏳ Saldo pendente: ${formatarMoeda(resultado.situacao.saldoCentavos)}`;
  }
}
