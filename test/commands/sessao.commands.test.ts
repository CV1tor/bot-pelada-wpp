import { describe, expect, it, vi } from 'vitest';
import { AbrirPeladaCommand } from '../../src/commands/abrir-pelada.command.js';
import { ConfirmarCommand } from '../../src/commands/confirmar.command.js';
import { EstatisticasCommand } from '../../src/commands/estatisticas.command.js';
import { PagueiCommand } from '../../src/commands/paguei.command.js';
import { SairCommand } from '../../src/commands/sair.command.js';
import type { EstatisticasService } from '../../src/services/estatisticas.service.js';
import type { ListaService } from '../../src/services/lista.service.js';
import type { SessaoService } from '../../src/services/sessao.service.js';
import { contexto, jogador } from '../helpers.js';

describe('comandos da pelada', () => {
  it('!abrir-pelada interpreta data, hora e valor total', async () => {
    const abrir = vi.fn().mockImplementation((data: Date, valor: number) => ({
      tipo: 'aberta',
      sessao: { id: 'sessao-1', data, valorTotalCentavos: valor, participantes: [] },
    }));
    const comando = new AbrirPeladaCommand({ abrir } as unknown as SessaoService);

    await expect(
      comando.executar({ ...contexto, argumentos: ['15/09/2026', '20:00', '200'] }),
    ).resolves.toContain('R$ 200,00');
    expect(abrir).toHaveBeenCalledWith(new Date('2026-09-15T23:00:00.000Z'), 20000);
  });

  it('!confirmar adiciona o próprio remetente', async () => {
    const adicionar = vi.fn().mockResolvedValue({ tipo: 'adicionado', jogador: jogador() });
    const comando = new ConfirmarCommand({ adicionar } as unknown as ListaService);

    await expect(comando.executar(contexto)).resolves.toContain('confirmou presença');
    expect(adicionar).toHaveBeenCalledWith(contexto.remetenteJid, contexto.remetenteNome);
  });

  it('!sair remove apenas o próprio remetente', async () => {
    const sair = vi.fn().mockResolvedValue({ tipo: 'removido', jogador: jogador() });
    const comando = new SairCommand({ sair } as unknown as ListaService);

    await expect(comando.executar(contexto)).resolves.toContain('saiu da lista');
    expect(sair).toHaveBeenCalledWith(contexto.remetenteJid);
  });

  it('!paguei registra a parcela e mostra o saldo restante', async () => {
    const pagar = vi.fn().mockResolvedValue({
      tipo: 'registrado',
      valorPagoCentavos: 2000,
      situacao: { saldoCentavos: 18000 },
    });
    const comando = new PagueiCommand({ pagar } as unknown as SessaoService);

    await expect(comando.executar(contexto)).resolves.toContain('R$ 180,00');
  });

  it('!estatisticas mostra somente os indicadores definidos', async () => {
    const obter = vi.fn().mockResolvedValue({
      tipo: 'encontrado',
      estatisticas: {
        jogador: jogador(),
        peladasPresentes: 8,
        rating: 4.6,
        totalAvaliacoes: 10,
        sequenciaAtual: 3,
      },
    });
    const comando = new EstatisticasCommand({ obter } as unknown as EstatisticasService);

    const resposta = await comando.executar(contexto);
    expect(resposta).toContain('Peladas presentes: 8');
    expect(resposta).toContain('Rating: 4.6');
    expect(resposta).toContain('Sequência atual: 3');
  });
});
