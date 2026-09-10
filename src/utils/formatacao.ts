const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const formatarMoeda = (centavos: number): string => formatadorMoeda.format(centavos / 100);

export const formatarDataHora = (data: Date): string =>
  data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza',
  });

export const interpretarDataHora = (data: string, hora: string): Date | null => {
  const dataEncontrada = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const horaEncontrada = hora.match(/^(\d{2}):(\d{2})$/);
  if (!dataEncontrada || !horaEncontrada) return null;
  const [, dia, mes, ano] = dataEncontrada;
  const [, horas, minutos] = horaEncontrada;
  const dataInterpretada = new Date(`${ano}-${mes}-${dia}T${horas}:${minutos}:00-03:00`);
  if (Number.isNaN(dataInterpretada.getTime())) return null;
  const confirmacao = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(dataInterpretada);
  return confirmacao === `${dia}/${mes}/${ano}, ${horas}:${minutos}` ? dataInterpretada : null;
};

export const interpretarMoedaEmCentavos = (valor: string): number | null => {
  const normalizado = valor
    .replace(/^R\$\s*/i, '')
    .replaceAll('.', '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const centavos = Math.round(Number(normalizado) * 100);
  return centavos > 0 ? centavos : null;
};
