import { describe, expect, it } from 'vitest';
import { calcularSituacaoFinanceira } from '../../src/utils/calcular-situacao-financeira.js';

describe('calcularSituacaoFinanceira', () => {
  it('divide o valor total entre todos os confirmados pendentes', () => {
    const participantes = Array.from({ length: 10 }, () => ({
      canceladoEm: null,
      pagoEm: null,
      valorPagoCentavos: null,
    }));

    expect(calcularSituacaoFinanceira(20000, participantes)).toEqual({
      valorTotalCentavos: 20000,
      valorRecebidoCentavos: 0,
      saldoCentavos: 20000,
      quantidadePendentes: 10,
      valorIndividualCentavos: 2000,
    });
  });

  it('preserva o valor pago e redistribui o saldo após uma saída', () => {
    const participantes = [
      { canceladoEm: null, pagoEm: new Date(), valorPagoCentavos: 2000 },
      { canceladoEm: new Date(), pagoEm: null, valorPagoCentavos: null },
      ...Array.from({ length: 8 }, () => ({
        canceladoEm: null,
        pagoEm: null,
        valorPagoCentavos: null,
      })),
    ];

    expect(calcularSituacaoFinanceira(20000, participantes)).toMatchObject({
      valorRecebidoCentavos: 2000,
      saldoCentavos: 18000,
      quantidadePendentes: 8,
      valorIndividualCentavos: 2250,
    });
  });
});
