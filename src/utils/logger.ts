export interface LoggerAplicacao {
  info(dados: unknown, mensagem?: string): void;
  error(dados: unknown, mensagem?: string): void;
}
