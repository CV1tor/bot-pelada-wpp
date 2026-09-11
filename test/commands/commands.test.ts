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
        data: new Date('2026-09-15T23:00:00.000Z'),
        valorTotalCentavos: 20000,
        participantes: [
          {
            ...jogador(),
            confirmadoEm: new Date(),
            canceladoEm: null,
            presente: false,
            pagoEm: null,
            valorPagoCentavos: null,
          },
        ],
      }),
      obterSituacaoFinanceira: vi.fn().mockResolvedValue({
        valorTotalCentavos: 20000,
        valorRecebidoCentavos: 0,
        saldoCentavos: 20000,
        quantidadePendentes: 1,
        valorIndividualCentavos: 20000,
      }),
    } as unknown as ListaService;
    await expect(new ListaCommand(servico).executar()).resolves.toContain('1. João');
  });

  it('!adicionar inclui o autor', async () => {
    const servico = {
      adicionar: vi.fn().mockResolvedValue({ tipo: 'adicionado', jogador: jogador() }),
    } as unknown as ListaService;
    await expect(new AdicionarCommand(servico).executar(contexto)).resolves.toContain('adicionado');
  });

  it('!adicionar com nome inclui um participante avulso', async () => {
    const adicionarAvulso = vi.fn().mockResolvedValue({
      tipo: 'adicionado',
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
      iniciar: vi.fn().mockResolvedValue({ tipo: 'aberta', votacao: votacao() }),
    } as unknown as VotacaoService;
    const comando = new VotacaoCommand(servico);

    expect(comando.restritoAAdministrador).toBe(true);
    await expect(comando.executar({ ...contexto, argumentos: ['João'] })).resolves.toContain(
      'Enquete aberta',
    );
  });

  it('!votacao sem argumentos abre enquetes para os confirmados e resume o processamento', async () => {
    const iniciarTodos = vi.fn().mockResolvedValue({
      tipo: 'processada',
      abertas: [votacao()],
      existentes: [{ ...votacao(), id: 'votacao-2' }],
      falhas: [jogador('jogador-3', 'Pedro')],
    });
    const servico = { iniciarTodos } as unknown as VotacaoService;

    const resposta = await new VotacaoCommand(servico).executar({
      ...contexto,
      argumentos: [],
    });

    expect(iniciarTodos).toHaveBeenCalledWith(contexto.grupoJid);
    expect(resposta).toContain('1 enquete(s) aberta(s)');
    expect(resposta).toContain('1 já estava(m) ativa(s)');
    expect(resposta).toContain('Falha ao abrir 1: Pedro');
  });

  it('!votacao todos informa quando não há confirmados', async () => {
    const servico = {
      iniciarTodos: vi.fn().mockResolvedValue({ tipo: 'sem_participantes' }),
    } as unknown as VotacaoService;

    await expect(
      new VotacaoCommand(servico).executar({ ...contexto, argumentos: ['todos'] }),
    ).resolves.toContain('Não há jogadores confirmados');
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
    await expect(comando.executar({ ...contexto, argumentos: ['João'] })).resolves.toContain(
      'média 4.5 ⭐ em 2 voto(s)',
    );
    expect(servico.encerrarAtiva).toHaveBeenCalledWith('João', contexto.grupoJid);
  });

  it('!encerrar-votacao informa quando não existe votação ativa', async () => {
    const servico = {
      encerrarAtiva: vi.fn().mockResolvedValue({ tipo: 'sem_votacao' }),
    } as unknown as VotacaoService;

    await expect(
      new EncerrarVotacaoCommand(servico).executar({ ...contexto, argumentos: ['João'] }),
    ).resolves.toContain('Não há votação ativa para “João”');
  });

  it('!encerrar-votacao sem argumentos publica todos os resultados', async () => {
    const encerrarTodasAtivas = vi.fn().mockResolvedValue({
      tipo: 'encerradas',
      resultados: [
        {
          votacao: { ...votacao(), fechada: true },
          resultado: { jogador: jogador(), media: 4.5, totalVotos: 2 },
        },
        {
          votacao: { ...votacao(), id: 'votacao-2', fechada: true },
          resultado: {
            jogador: jogador('jogador-2', 'Maria'),
            media: null,
            totalVotos: 0,
          },
        },
      ],
      ignoradas: 1,
    });
    const servico = { encerrarTodasAtivas } as unknown as VotacaoService;

    const resposta = await new EncerrarVotacaoCommand(servico).executar({
      ...contexto,
      argumentos: [],
    });

    expect(encerrarTodasAtivas).toHaveBeenCalledWith(contexto.grupoJid);
    expect(resposta).toContain('João recebeu média 4.5');
    expect(resposta).toContain('Maria não recebeu votos');
    expect(resposta).toContain('1 votação(ões) já havia(m) sido encerrada(s)');
  });

  it('!encerrar-votacao todas informa quando não existem votações ativas', async () => {
    const servico = {
      encerrarTodasAtivas: vi.fn().mockResolvedValue({ tipo: 'sem_votacao' }),
    } as unknown as VotacaoService;

    await expect(
      new EncerrarVotacaoCommand(servico).executar({ ...contexto, argumentos: ['todas'] }),
    ).resolves.toBe('Não há votações ativas.');
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
