import type { FastifyInstance } from 'fastify';
import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';
import type { DispatcherComandos } from '../commands/dispatcher.js';
import type { VotacaoService } from '../services/votacao.service.js';
import { formatarResultadoVotacao } from '../utils/formatar-resultado-votacao.js';
import { interpretarEventoWebhook } from './webhook.schema.js';

export interface DependenciasWebhook {
  grupoAutorizado: string;
  dispatcher: DispatcherComandos;
  votacaoService: VotacaoService;
  clienteEvolution: ClienteEvolutionApi;
}

export const registrarWebhook = (
  servidor: FastifyInstance,
  dependencias: DependenciasWebhook,
): void => {
  servidor.post('/webhook', async (requisicao, resposta) => {
    const evento = interpretarEventoWebhook(requisicao.body);
    await publicarVotacoesEncerradas(dependencias);

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

const publicarVotacoesEncerradas = async (dependencias: DependenciasWebhook): Promise<void> => {
  const encerradas = await dependencias.votacaoService.fecharExpiradas();
  for (const { votacao, resultado } of encerradas) {
    await dependencias.clienteEvolution.enviarTexto(
      votacao.grupoJid,
      formatarResultadoVotacao(resultado),
    );
  }
};
