import type { ResumoMensalService } from './resumo-mensal.service.js';

const INTERVALO_VERIFICACAO_EM_MILISSEGUNDOS = 60 * 60 * 1000;

export class AgendadorResumoMensal {
  private temporizador: ReturnType<typeof setInterval> | null = null;

  public constructor(
    private readonly resumoMensalService: ResumoMensalService,
    private readonly aoFalhar: (erro: unknown) => void,
  ) {}

  public iniciar(): void {
    void this.executar();
    this.temporizador = setInterval(
      () => void this.executar(),
      INTERVALO_VERIFICACAO_EM_MILISSEGUNDOS,
    );
    this.temporizador.unref();
  }

  public parar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  private async executar(): Promise<void> {
    try {
      await this.resumoMensalService.publicarMesAnterior();
    } catch (erro) {
      this.aoFalhar(erro);
    }
  }
}
