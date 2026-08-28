import type { JogadorAvaliado } from '../models/types.js';
import type { RepositorioAvaliacao } from '../repositories/avaliacao.repository.js';

export class RankingService {
  public constructor(private readonly repositorioAvaliacao: RepositorioAvaliacao) {}

  public listar(): Promise<JogadorAvaliado[]> {
    return this.repositorioAvaliacao.listarRanking(3);
  }
}
