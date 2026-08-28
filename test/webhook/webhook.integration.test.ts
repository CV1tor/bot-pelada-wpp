import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { DispatcherComandos } from '../../src/commands/dispatcher.js';
import type { VotacaoService } from '../../src/services/votacao.service.js';
import { registrarWebhook } from '../../src/webhook/webhook.controller.js';
import { interpretarEventoWebhook } from '../../src/webhook/webhook.schema.js';
import { criarClienteEvolutionMock } from '../helpers.js';

describe('webhook', () => {
  it('processa MESSAGES_UPSERT apenas no grupo autorizado', async () => {
    const evolution = criarClienteEvolutionMock();
    const dispatcher = new DispatcherComandos(evolution);
    dispatcher.registrar({
      nome: 'eco',
      descricao: 'teste',
      executar: async ({ remetenteNome }) => `Olá, ${remetenteNome}`,
    });
    const votacaoService = {
      fecharExpiradas: vi.fn().mockResolvedValue([]),
      registrarVotoEnquete: vi.fn(),
    } as unknown as VotacaoService;
    const servidor = Fastify();
    registrarWebhook(servidor, {
      grupoAutorizado: 'grupo@g.us',
      dispatcher,
      votacaoService,
      clienteEvolution: evolution,
    });

    const resposta = await servidor.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            remoteJid: 'grupo@g.us',
            participant: '5511@s.whatsapp.net',
            fromMe: false,
          },
          pushName: 'João',
          message: { conversation: '!eco' },
        },
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(evolution.enviarTexto).toHaveBeenCalledWith('grupo@g.us', 'Olá, João');
    await servidor.close();
  });

  it('decodifica hash binário da opção em POLLS_UPDATE', () => {
    const hash = [...createHash('sha256').update('5 ⭐').digest()];
    const evento = interpretarEventoWebhook({
      event: 'POLLS_UPDATE',
      data: {
        key: { remoteJid: 'grupo@g.us', participant: '5522@s.whatsapp.net' },
        pollUpdates: [
          {
            pollUpdateMessageKey: { id: 'poll-1' },
            vote: { selectedOptions: [{ type: 'Buffer', data: hash }] },
          },
        ],
      },
    });

    expect(evento).toEqual({
      tipo: 'enquete',
      atualizacoes: [
        {
          grupoJid: 'grupo@g.us',
          remetenteJid: '5522@s.whatsapp.net',
          mensagemEnqueteId: 'poll-1',
          opcoesSelecionadas: ['5 ⭐'],
        },
      ],
    });
  });
});
