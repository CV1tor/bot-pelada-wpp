import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import { AdicionarCommand } from './commands/adicionar.command.js';
import { AjudaCommand } from './commands/ajuda.command.js';
import { DispatcherComandos } from './commands/dispatcher.js';
import { LimparCommand } from './commands/limpar.command.js';
import { ListaCommand } from './commands/lista.command.js';
import { PixCommand } from './commands/pix.command.js';
import { RankingCommand } from './commands/ranking.command.js';
import { RemoverCommand } from './commands/remover.command.js';
import { SorteioCommand } from './commands/sorteio.command.js';
import { VotacaoCommand } from './commands/votacao.command.js';
import { VotoCommand } from './commands/voto.command.js';
import type { Configuracao } from './config.js';
import {
  EvolutionApiClient,
  type ClienteEvolutionApi,
} from './integrations/evolution-api.client.js';
import { RepositorioAvaliacaoPrisma } from './repositories/avaliacao.repository.js';
import { RepositorioJogadorPrisma } from './repositories/player.repository.js';
import { RepositorioSessaoPrisma } from './repositories/sessao.repository.js';
import { RepositorioVotacaoPrisma } from './repositories/votacao.repository.js';
import { ListaService } from './services/lista.service.js';
import { RankingService } from './services/ranking.service.js';
import { SorteioService } from './services/sorteio.service.js';
import { VotacaoService } from './services/votacao.service.js';
import { registrarWebhook } from './webhook/webhook.controller.js';

export interface OpcoesAplicacao {
  prisma?: PrismaClient;
  clienteEvolution?: ClienteEvolutionApi;
  logger?: boolean;
}

export const criarAplicacao = (
  configuracao: Configuracao,
  opcoes: OpcoesAplicacao = {},
): FastifyInstance => {
  const servidor = Fastify({ logger: opcoes.logger ?? true });
  const prisma = opcoes.prisma ?? new PrismaClient({ datasourceUrl: configuracao.databaseUrl });
  const clienteEvolution =
    opcoes.clienteEvolution ??
    new EvolutionApiClient({
      urlBase: configuracao.evolutionApiUrl,
      chaveApi: configuracao.evolutionApiKey,
      instancia: configuracao.evolutionInstanceName,
    });
  const repositorioJogador = new RepositorioJogadorPrisma(prisma);
  const repositorioSessao = new RepositorioSessaoPrisma(prisma);
  const repositorioAvaliacao = new RepositorioAvaliacaoPrisma(prisma);
  const repositorioVotacao = new RepositorioVotacaoPrisma(prisma);
  const listaService = new ListaService(repositorioJogador, repositorioSessao);
  const rankingService = new RankingService(repositorioAvaliacao);
  const sorteioService = new SorteioService(repositorioSessao);
  const votacaoService = new VotacaoService(
    repositorioJogador,
    repositorioVotacao,
    repositorioAvaliacao,
    clienteEvolution,
  );
  const dispatcher = new DispatcherComandos(clienteEvolution);

  dispatcher.registrar(
    new AdicionarCommand(listaService),
    new AjudaCommand(() => dispatcher.listar()),
    new LimparCommand(listaService),
    new ListaCommand(listaService),
    new PixCommand(configuracao.pixKey, configuracao.pixNome),
    new RankingCommand(rankingService),
    new RemoverCommand(listaService),
    new SorteioCommand(sorteioService),
    new VotacaoCommand(votacaoService),
    new VotoCommand(votacaoService),
  );

  servidor.get('/health', () => ({ status: 'ok' }));
  registrarWebhook(servidor, {
    grupoAutorizado: configuracao.whatsappGroupId,
    dispatcher,
    votacaoService,
    clienteEvolution,
  });
  servidor.addHook('onClose', async () => prisma.$disconnect());
  return servidor;
};
