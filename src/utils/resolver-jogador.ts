import type { Jogador } from '../models/types.js';
import { normalizarTexto } from './normalizacao.js';

export type ResultadoResolucaoJogador =
  | { tipo: 'encontrado'; jogador: Jogador }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ambiguo'; jogadores: Jogador[] };

export const resolverJogadorPorNome = (
  jogadores: Jogador[],
  nomeInformado: string,
): ResultadoResolucaoJogador => {
  const nomeNormalizado = normalizarTexto(nomeInformado);
  if (!nomeNormalizado) return { tipo: 'nao_encontrado' };

  const correspondencias = jogadores.filter((jogador) =>
    normalizarTexto(jogador.nome).includes(nomeNormalizado),
  );

  const correspondenciaExata = correspondencias.find(
    (jogador) => normalizarTexto(jogador.nome) === nomeNormalizado,
  );
  if (correspondenciaExata) return { tipo: 'encontrado', jogador: correspondenciaExata };
  if (correspondencias.length === 1 && correspondencias[0]) {
    return { tipo: 'encontrado', jogador: correspondencias[0] };
  }
  if (correspondencias.length > 1) return { tipo: 'ambiguo', jogadores: correspondencias };
  return { tipo: 'nao_encontrado' };
};
