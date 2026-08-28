export interface Configuracao {
  porta: number;
  databaseUrl: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
  whatsappGroupId: string;
  pixKey: string;
  pixNome: string;
}

const exigirVariavel = (nome: string): string => {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
};

export const carregarConfiguracao = (): Configuracao => ({
  porta: Number(process.env.PORT ?? 3000),
  databaseUrl: exigirVariavel('DATABASE_URL'),
  evolutionApiUrl: exigirVariavel('EVOLUTION_API_URL').replace(/\/$/, ''),
  evolutionApiKey: exigirVariavel('EVOLUTION_API_KEY'),
  evolutionInstanceName: exigirVariavel('EVOLUTION_INSTANCE_NAME'),
  whatsappGroupId: exigirVariavel('WHATSAPP_GROUP_ID'),
  pixKey: exigirVariavel('PIX_KEY'),
  pixNome: exigirVariavel('PIX_NOME'),
});
