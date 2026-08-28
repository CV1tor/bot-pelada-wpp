import type { ClienteEvolutionApi } from '../integrations/evolution-api.client.js';

export const ehAdministradorDoGrupo = async (
  clienteEvolution: ClienteEvolutionApi,
  grupoJid: string,
  remetenteJid: string,
): Promise<boolean> => {
  const participantes = await clienteEvolution.obterParticipantesGrupo(grupoJid);
  const participante = participantes.find(({ jid }) => jid === remetenteJid);
  return participante?.papel === 'admin' || participante?.papel === 'superadmin';
};
