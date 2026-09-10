import type { SituacaoFinanceira } from '../models/types.js';

export interface PagamentoParticipante {
  canceladoEm: Date | null;
  pagoEm: Date | null;
  valorPagoCentavos: number | null;
}

export const calcularSituacaoFinanceira = (
  valorTotalCentavos: number,
  participantes: PagamentoParticipante[],
): SituacaoFinanceira => {
  const valorRecebidoCentavos = participantes.reduce(
    (total, participante) => total + (participante.valorPagoCentavos ?? 0),
    0,
  );
  const quantidadePendentes = participantes.filter(
    ({ canceladoEm, pagoEm }) => !canceladoEm && !pagoEm,
  ).length;
  const saldoCentavos = Math.max(0, valorTotalCentavos - valorRecebidoCentavos);
  return {
    valorTotalCentavos,
    valorRecebidoCentavos,
    saldoCentavos,
    quantidadePendentes,
    valorIndividualCentavos: quantidadePendentes
      ? Math.round(saldoCentavos / quantidadePendentes)
      : 0,
  };
};
