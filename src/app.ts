import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import { AdicionarCommand } from './commands/adicionar.command.js';
import { AbrirPeladaCommand } from './commands/abrir-pelada.command.js';
import { AjudaCommand } from './commands/ajuda.command.js';
import { DispatcherComandos } from './commands/dispatcher.js';
import { EncerrarVotacaoCommand } from './commands/encerrar-votacao.command.js';
import { EncerrarPeladaCommand } from './commands/encerrar-pelada.command.js';
import { EstatisticasCommand } from './commands/estatisticas.command.js';
import { LimparCommand } from './commands/limpar.command.js';
import { ListaCommand } from './commands/lista.command.js';
import { PixCommand } from './commands/pix.command.js';
import { PagueiCommand } from './commands/paguei.command.js';
import { RankingCommand } from './commands/ranking.command.js';
import { RemoverCommand } from './commands/remover.command.js';
import { SorteioCommand } from './commands/sorteio.command.js';
import { ConfirmarCommand } from './commands/confirmar.command.js';
import { SairCommand } from './commands/sair.command.js';
import { VotacaoCommand } from './commands/votacao.command.js';
import type { Configuracao } from './config.js';
import {
  EvolutionApiClient,
  type ClienteEvolutionApi,
} from './integrations/evolution-api.client.js';
import { RepositorioAvaliacaoPrisma } from './repositories/avaliacao.repository.js';
import { RepositorioEstatisticasPrisma } from './repositories/estatisticas.repository.js';
import { RepositorioJogadorPrisma } from './repositories/player.repository.js';
import { RepositorioSessaoPrisma } from './repositories/sessao.repository.js';
import { RepositorioVotacaoPrisma } from './repositories/votacao.repository.js';
import { ListaService } from './services/lista.service.js';
import { AgendadorResumoMensal } from './services/agendador-resumo-mensal.js';
import { EstatisticasService } from './services/estatisticas.service.js';
import { RankingService } from './services/ranking.service.js';
import { SorteioService } from './services/sorteio.service.js';
import { ResumoMensalService } from './services/resumo-mensal.service.js';
import { SessaoService } from './services/sessao.service.js';
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
  const repositorioEstatisticas = new RepositorioEstatisticasPrisma(prisma);
  const repositorioVotacao = new RepositorioVotacaoPrisma(prisma);
  const listaService = new ListaService(repositorioJogador, repositorioSessao);
  const sessaoService = new SessaoService(repositorioSessao, repositorioJogador);
  const estatisticasService = new EstatisticasService(repositorioJogador, repositorioEstatisticas);
  const rankingService = new RankingService(repositorioAvaliacao);
  const sorteioService = new SorteioService(repositorioSessao);
  const votacaoService = new VotacaoService(
    repositorioJogador,
    repositorioVotacao,
    repositorioAvaliacao,
    clienteEvolution,
    repositorioSessao,
  );
  const resumoMensalService = new ResumoMensalService(
    repositorioEstatisticas,
    clienteEvolution,
    configuracao.whatsappGroupId,
  );
  const agendadorResumoMensal = new AgendadorResumoMensal(resumoMensalService, (erro) =>
    servidor.log.error(erro, 'Falha ao publicar resumo mensal'),
  );
  const dispatcher = new DispatcherComandos(clienteEvolution);

  dispatcher.registrar(
    new AbrirPeladaCommand(sessaoService),
    new AdicionarCommand(listaService),
    new AjudaCommand(() => dispatcher.listar()),
    new ConfirmarCommand(listaService),
    new EncerrarPeladaCommand(sessaoService),
    new EncerrarVotacaoCommand(votacaoService),
    new EstatisticasCommand(estatisticasService),
    new LimparCommand(listaService),
    new ListaCommand(listaService),
    new PagueiCommand(sessaoService),
    new PixCommand(configuracao.pixKey, configuracao.pixNome),
    new RankingCommand(rankingService),
    new RemoverCommand(listaService),
    new SairCommand(listaService),
    new SorteioCommand(sorteioService),
    new VotacaoCommand(votacaoService),
  );

  servidor.get('/health', () => ({ status: 'ok' }));
  servidor.addHook('onReady', () => agendadorResumoMensal.iniciar());
  registrarWebhook(servidor, {
    grupoAutorizado: configuracao.whatsappGroupId,
    dispatcher,
    votacaoService,
    clienteEvolution,
  });
  servidor.addHook('onClose', async () => {
    agendadorResumoMensal.parar();
    await prisma.$disconnect();
  });
  return servidor;
};
