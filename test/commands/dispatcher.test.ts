import { describe, expect, it, vi } from 'vitest';
import { DispatcherComandos, interpretarComando } from '../../src/commands/dispatcher.js';
import type { Comando } from '../../src/models/types.js';
import { contexto, criarClienteEvolutionMock } from '../helpers.js';

describe('DispatcherComandos', () => {
  it('interpreta comando e argumentos ignorando espaços', () => {
    expect(interpretarComando('  !ReMoVeR   João Silva ')).toEqual({
      nome: 'remover',
      argumentos: ['João', 'Silva'],
    });
  });

  it('nega comando restrito para não administrador', async () => {
    const evolution = criarClienteEvolutionMock();
    vi.mocked(evolution.obterParticipantesGrupo).mockResolvedValue([
      { jid: contexto.remetenteJid, papel: 'membro' },
    ]);
    const executar = vi.fn<Comando['executar']>().mockResolvedValue('executado');
    const dispatcher = new DispatcherComandos(evolution);
    dispatcher.registrar({
      nome: 'restrito',
      descricao: 'teste',
      restritoAAdministrador: true,
      executar,
    });

    const resposta = await dispatcher.despachar('!restrito', contexto);

    expect(resposta).toContain('administradores');
    expect(executar).not.toHaveBeenCalled();
  });
});
