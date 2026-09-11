import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import { formatarResultadoVotacao } from '../utils/formatar-resultado-votacao.js';
import type { VotacaoService } from './votacao.service.js';

export class PublicadorVotacoesExpiradas {
  public constructor(
    private readonly votacaoService: VotacaoService,
    private readonly clienteEvolution: ClienteEvolutionApi,
  ) {}

  public async publicar(): Promise<void> {
    const encerradas = await this.votacaoService.fecharExpiradas();
    for (const { votacao, resultado } of encerradas) {
      await this.clienteEvolution.enviarTexto(
        votacao.grupoJid,
        formatarResultadoVotacao(resultado),
      );
    }
  }
}
