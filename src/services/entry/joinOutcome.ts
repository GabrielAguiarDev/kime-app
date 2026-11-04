import type { JoinResult } from '@domain/Gym';

/** What a join with a code amounted to (the database never duplicates a request). */
export type JoinOutcome = 'sent' | 'alreadyMember' | 'alreadyPending';

export function joinOutcome(result: Pick<JoinResult, 'status' | 'isNew'>): JoinOutcome {
  if (result.status === 'active') return 'alreadyMember';
  return result.isNew ? 'sent' : 'alreadyPending';
}

/** Same words wherever the code is used (code screen, code saved before sign-in). */
export function joinOutcomeText(outcome: JoinOutcome, gymName: string | null | undefined): { title: string; message: string } {
  const name = gymName || 'academia';
  switch (outcome) {
    case 'alreadyMember':
      return { title: `Você já faz parte da ${name}.`, message: 'Nenhum pedido novo foi criado.' };
    case 'alreadyPending':
      return {
        title: `Seu pedido para a ${name} já está aguardando aprovação.`,
        message: 'Assim que for aprovado, ela fica disponível no seu Perfil.',
      };
    case 'sent':
      return {
        title: 'Pedido enviado',
        message: `Ela aparece no seu Perfil como "Aguardando aprovação" até a ${name} aprovar.`,
      };
  }
}
