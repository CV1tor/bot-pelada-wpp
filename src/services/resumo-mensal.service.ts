import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import type { ResumoMensal } from '../models/types.js';
import type { RepositorioEstatisticas } from '../repositories/estatisticas.repository.js';

export class ResumoMensalService {
  public constructor(
    private readonly repositorioEstatisticas: RepositorioEstatisticas,
    private readonly clienteEvolution: ClienteEvolutionApi,
    private readonly grupoJid: string,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  public async publicarMesAnterior(): Promise<boolean> {
    const { inicio, fim, competencia } = this.obterPeriodoAnterior(this.agora());
    const possuiVotacaoEmAndamento = await this.repositorioEstatisticas.possuiVotacaoEmAndamento(
      inicio,
      fim,
      this.agora(),
    );
    if (possuiVotacaoEmAndamento) return false;
    const reservado = await this.repositorioEstatisticas.reservarPublicacaoMensal(competencia);
    if (!reservado) return false;
    try {
      const resumo = await this.repositorioEstatisticas.obterResumoMensal(inicio, fim, competencia);
      await this.clienteEvolution.enviarTexto(this.grupoJid, this.formatar(resumo));
      return true;
    } catch (erro) {
      await this.repositorioEstatisticas.liberarPublicacaoMensal(competencia);
      throw erro;
    }
  }

  private obterPeriodoAnterior(agora: Date): { inicio: Date; fim: Date; competencia: string } {
    const anoAtual = Number(
      agora.toLocaleString('en-US', { timeZone: 'America/Fortaleza', year: 'numeric' }),
    );
    const mesAtual = Number(
      agora.toLocaleString('en-US', { timeZone: 'America/Fortaleza', month: 'numeric' }),
    );
    const fim = new Date(`${anoAtual}-${String(mesAtual).padStart(2, '0')}-01T00:00:00-03:00`);
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    const inicio = new Date(
      `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01T00:00:00-03:00`,
    );
    return { inicio, fim, competencia: `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}` };
  }

  private formatar(resumo: ResumoMensal): string {
    const [ano, mes] = resumo.competencia.split('-').map(Number);
    const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
      new Date(Date.UTC(ano ?? 0, (mes ?? 1) - 1, 1)),
    );
    const destaque = resumo.destaque
      ? `⭐ Maior rating do mês: ${resumo.destaque.nome} — ${resumo.destaque.media.toFixed(1)} (${resumo.destaque.totalAvaliacoes} avaliações)`
      : '⭐ Maior rating do mês: ainda não houve avaliações.';
    return `📅 Resumo de ${nomeMes}\n\n🏐 Peladas realizadas: ${resumo.quantidadePeladas}\n${destaque}`;
  }
}
