import type { Comando, ContextoComando } from '../models/types.js';
import type { SessaoService } from '../services/sessao.service.js';
import {
  formatarDataHora,
  formatarMoeda,
  interpretarDataHora,
  interpretarMoedaEmCentavos,
} from '../utils/formatacao.js';

export class AbrirPeladaCommand implements Comando {
  public readonly nome = 'abrir-pelada';
  public readonly descricao = 'abre uma pelada: !abrir-pelada DD/MM/AAAA HH:mm VALOR (admin)';
  public readonly restritoAAdministrador = true;

  public constructor(private readonly sessaoService: SessaoService) {}

  public async executar(contexto: ContextoComando): Promise<string> {
    const [dataInformada, horaInformada, valorInformado] = contexto.argumentos;
    if (!dataInformada || !horaInformada || !valorInformado) {
      return 'Use: !abrir-pelada DD/MM/AAAA HH:mm VALOR. Exemplo: !abrir-pelada 15/09/2026 20:00 200';
    }
    const data = interpretarDataHora(dataInformada, horaInformada);
    const valorTotalCentavos = interpretarMoedaEmCentavos(valorInformado);
    if (!data) return 'Informe uma data e hora válidas no formato DD/MM/AAAA HH:mm.';
    if (!valorTotalCentavos) return 'Informe um valor total válido e maior que zero.';
    const resultado = await this.sessaoService.abrir(data, valorTotalCentavos);
    if (resultado.tipo === 'ja_existe') {
      return `Já existe uma pelada aberta para ${formatarDataHora(resultado.sessao.data)}.`;
    }
    return `🏐 Pelada aberta para ${formatarDataHora(data)}.\n💰 Valor total: ${formatarMoeda(valorTotalCentavos)}\nUse !confirmar para entrar na lista.`;
  }
}
