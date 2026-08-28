import { criarAplicacao } from './app.js';
import { carregarConfiguracao } from './config.js';

const configuracao = carregarConfiguracao();
const servidor = criarAplicacao(configuracao);

const encerrar = async (): Promise<void> => {
  await servidor.close();
  process.exit(0);
};

process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());

try {
  await servidor.listen({ port: configuracao.porta, host: '0.0.0.0' });
} catch (erro) {
  servidor.log.error(erro);
  process.exit(1);
}
