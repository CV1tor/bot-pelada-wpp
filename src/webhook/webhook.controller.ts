import type { FastifyInstance } from 'fastify';
import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import type { DispatcherComandos } from '../commands/dispatcher.js';
import type { VotacaoService } from '../services/votacao.service.js';
import type { PublicadorVotacoesExpiradas } from '../services/publicador-votacoes-expiradas.js';
import { interpretarEventoWebhook } from './webhook.schema.js';

export interface DependenciasWebhook {
  grupoAutorizado: string;
  dispatcher: DispatcherComandos;
  votacaoService: VotacaoService;
  publicadorVotacoesExpiradas: PublicadorVotacoesExpiradas;
  clienteEvolution: ClienteEvolutionApi;
}

export const registrarWebhook = (
  servidor: FastifyInstance,
  dependencias: DependenciasWebhook,
): void => {
  servidor.post('/webhook', async (requisicao, resposta) => {
    const evento = interpretarEventoWebhook(requisicao.body);
    await dependencias.publicadorVotacoesExpiradas.publicar();

    if (evento.tipo === 'mensagem') {
      const mensagem = evento.mensagem;
      if (
        mensagem.grupoJid !== dependencias.grupoAutorizado ||
        mensagem.enviadaPeloBot ||
        !mensagem.texto.trim().startsWith('!')
      ) {
        return resposta.code(204).send();
      }
      const retorno = await dependencias.dispatcher.despachar(mensagem.texto, {
        grupoJid: mensagem.grupoJid,
        remetenteJid: mensagem.remetenteJid,
        remetenteNome: mensagem.remetenteNome,
        mencionados: mensagem.mencionados,
      });
      if (retorno) await dependencias.clienteEvolution.enviarTexto(mensagem.grupoJid, retorno);
    }

    if (evento.tipo === 'enquete') {
      for (const atualizacao of evento.atualizacoes) {
        if (atualizacao.grupoJid && atualizacao.grupoJid !== dependencias.grupoAutorizado) continue;
        await dependencias.votacaoService.registrarVotoEnquete(
          atualizacao.mensagemEnqueteId,
          atualizacao.remetenteJid,
          atualizacao.opcoesSelecionadas,
        );
      }
    }

    return resposta.code(204).send();
  });
};
