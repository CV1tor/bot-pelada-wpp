import type { TimeSorteado } from '../models/types.js';
import type { RepositorioSessao } from '../repositories/sessao.repository.js';

export class SorteioService {
  public constructor(private readonly repositorioSessao: RepositorioSessao) {}

  public async sortear(quantidadeTimes: number): Promise<TimeSorteado[]> {
    if (!Number.isInteger(quantidadeTimes) || quantidadeTimes < 2) {
      throw new Error('A quantidade de times deve ser um número inteiro maior ou igual a 2.');
    }
    const sessao = await this.repositorioSessao.obterOuCriarAberta();
    const jogadores = await this.repositorioSessao.listarParticipantesAvaliados(sessao.id);
    if (jogadores.length < quantidadeTimes) {
      throw new Error('Não há jogadores suficientes para formar essa quantidade de times.');
    }
    const ordenados = [...jogadores].sort(
      (primeiro, segundo) =>
        segundo.media - primeiro.media || primeiro.nome.localeCompare(segundo.nome),
    );
    const times: TimeSorteado[] = Array.from({ length: quantidadeTimes }, (_, indice) => ({
      numero: indice + 1,
      jogadores: [],
      pontuacao: 0,
    }));

    ordenados.forEach((jogador, indice) => {
      const rodada = Math.floor(indice / quantidadeTimes);
      const posicaoNaRodada = indice % quantidadeTimes;
      const indiceTime = rodada % 2 === 0 ? posicaoNaRodada : quantidadeTimes - 1 - posicaoNaRodada;
      const time = times[indiceTime];
      if (!time) return;
      time.jogadores.push(jogador);
      time.pontuacao += jogador.media;
    });

    await this.repositorioSessao.substituirTimes(sessao.id, times);
    return times;
  }
}
