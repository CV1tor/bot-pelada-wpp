import { describe, expect, it, vi } from 'vitest';
import { AdicionarCommand } from '../../src/commands/adicionar.command.js';
import { AjudaCommand } from '../../src/commands/ajuda.command.js';
import { EncerrarVotacaoCommand } from '../../src/commands/encerrar-votacao.command.js';
import { LimparCommand } from '../../src/commands/limpar.command.js';
import { ListaCommand } from '../../src/commands/lista.command.js';
import { PixCommand } from '../../src/commands/pix.command.js';
import { RankingCommand } from '../../src/commands/ranking.command.js';
import { RemoverCommand } from '../../src/commands/remover.command.js';
import { SorteioCommand } from '../../src/commands/sorteio.command.js';
import { VotacaoCommand } from '../../src/commands/votacao.command.js';
import { VotoCommand } from '../../src/commands/voto.command.js';
import type { ListaService } from '../../src/services/lista.service.js';
import type { RankingService } from '../../src/services/ranking.service.js';
import type { SorteioService } from '../../src/services/sorteio.service.js';
import type { VotacaoService } from '../../src/services/votacao.service.js';
import { contexto, jogador, votacao } from '../helpers.js';

describe('handlers de comandos', () => {
  it('!lista numera os confirmados', async () => {
    const servico = {
      obterLista: vi.fn().mockResolvedValue({
        id: 'sessao',
        participantes: [{ ...jogador(), confirmadoEm: new Date() }],
      }),
    } as unknown as ListaService;
    await expect(new ListaCommand(servico).executar()).resolves.toContain('1. João');
  });

  it('!adicionar inclui o autor', async () => {
    const servico = {
      adicionar: vi.fn().mockResolvedValue({ adicionado: true, jogador: jogador() }),
    } as unknown as ListaService;
    await expect(new AdicionarCommand(servico).executar(contexto)).resolves.toContain('adicionado');
  });

  it('!adicionar com nome inclui um participante avulso', async () => {
    const adicionarAvulso = vi.fn().mockResolvedValue({
      adicionado: true,
      jogador: jogador('avulso', 'José da Silva', 'avulso:jose-da-silva'),
    });
    const servico = { adicionarAvulso } as unknown as ListaService;

    await expect(
      new AdicionarCommand(servico).executar({
        ...contexto,
        argumentos: ['José', 'da', 'Silva'],
      }),
    ).resolves.toContain('José da Silva foi adicionado');
    expect(adicionarAvulso).toHaveBeenCalledWith('José da Silva');
  });

  it('!limpar exige confirmação explícita', async () => {
    const servico = { limpar: vi.fn() } as unknown as ListaService;
    await expect(new LimparCommand(servico).executar(contexto)).resolves.toContain(
      '!limpar confirmar',
    );
  });

  it('!remover pede nome', async () => {
    const servico = { remover: vi.fn() } as unknown as ListaService;
    await expect(new RemoverCommand(servico).executar(contexto)).resolves.toContain('Informe quem');
  });

  it('!ranking formata média e total', async () => {
    const servico = {
      listar: vi.fn().mockResolvedValue([{ ...jogador(), media: 4.75, totalAvaliacoes: 4 }]),
    } as unknown as RankingService;
    await expect(new RankingCommand(servico).executar()).resolves.toContain('4.8 (4 avaliações)');
  });

  it('!votacao informa que abriu a enquete nativa', async () => {
    const servico = {
      iniciar: vi
        .fn()
        .mockResolvedValue({ tipo: 'aberta', votacao: votacao(), enqueteNativa: true }),
    } as unknown as VotacaoService;
    const comando = new VotacaoCommand(servico);

    expect(comando.restritoAAdministrador).toBe(true);
    await expect(comando.executar({ ...contexto, argumentos: ['João'] })).resolves.toContain(
      'Enquete aberta',
    );
  });

  it('!voto valida nota inteira de 1 a 5', async () => {
    const servico = {
      registrarVotoTexto: vi.fn().mockResolvedValue({ tipo: 'invalido' }),
    } as unknown as VotacaoService;
    await expect(
      new VotoCommand(servico).executar({ ...contexto, argumentos: ['7'] }),
    ).resolves.toContain('1 a 5');
  });

  it('!encerrar-votacao encerra e publica o resultado', async () => {
    const servico = {
      encerrarAtiva: vi.fn().mockResolvedValue({
        tipo: 'encerrada',
        votacao: { ...votacao(), fechada: true },
        resultado: { jogador: jogador(), media: 4.5, totalVotos: 2 },
      }),
    } as unknown as VotacaoService;
    const comando = new EncerrarVotacaoCommand(servico);

    expect(comando.restritoAAdministrador).toBe(true);
    await expect(comando.executar(contexto)).resolves.toContain('média 4.5 ⭐ em 2 voto(s)');
    expect(servico.encerrarAtiva).toHaveBeenCalledWith(contexto.grupoJid);
  });

  it('!encerrar-votacao informa quando não existe votação ativa', async () => {
    const servico = {
      encerrarAtiva: vi.fn().mockResolvedValue({ tipo: 'sem_votacao' }),
    } as unknown as VotacaoService;

    await expect(new EncerrarVotacaoCommand(servico).executar(contexto)).resolves.toContain(
      'Não há votação ativa',
    );
  });

  it('!pix usa a configuração', async () => {
    await expect(new PixCommand('chave@pix', 'Pelada').executar()).resolves.toContain('chave@pix');
  });

  it('!sorteio mostra a composição', async () => {
    const servico = {
      sortear: vi
        .fn()
        .mockResolvedValue([
          { numero: 1, jogadores: [{ ...jogador(), media: 3, totalAvaliacoes: 0 }], pontuacao: 3 },
        ]),
    } as unknown as SorteioService;
    await expect(new SorteioCommand(servico).executar(contexto)).resolves.toContain('Time 1: João');
  });

  it('!ajuda é gerado pelo registro recebido', async () => {
    const comando = new AjudaCommand(() => [new PixCommand('chave', 'nome')]);
    await expect(comando.executar()).resolves.toContain('!pix — mostra a chave Pix');
  });
});
