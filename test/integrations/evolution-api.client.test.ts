import { describe, expect, it, vi } from 'vitest';
import { EvolutionApiClient } from '../../src/integrations/evolution-api.client.js';

describe('EvolutionApiClient', () => {
  it('envia enquete nativa e serializa o messageSecret', async () => {
    const requisicao = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: { id: 'poll-1' },
          message: { messageContextInfo: { messageSecret: [1, 2, 3] } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const cliente = new EvolutionApiClient({
      urlBase: 'http://evolution',
      chaveApi: 'api-key',
      instancia: 'pelada',
      requisicao,
    });

    const resultado = await cliente.enviarEnquete('grupo@g.us', 'Avaliação', ['1 ⭐'], 1);

    expect(resultado).toEqual({ mensagemId: 'poll-1', segredo: 'AQID' });
    expect(requisicao).toHaveBeenCalledWith(
      'http://evolution/message/sendPoll/pelada',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          number: 'grupo@g.us',
          name: 'Avaliação',
          selectableCount: 1,
          values: ['1 ⭐'],
        }),
      }),
    );
  });
});
