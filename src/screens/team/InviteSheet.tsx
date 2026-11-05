import { useState } from 'react';

import { TextButton } from '@components';
import { SheetForm } from '@screens/professor/shared';

import { InviteCodesSection } from '../professor/InviteCodes';

/**
 * Equipe → "Convidar": the student code (copy, share and — owner only —
 * "Gerar novo código"). The owner reaches the professor code with "Convidar
 * professor", which swaps the content in place (one code at a time, no scroll).
 */
export function InviteSheet({ gymId, gymName, isOwner }: { gymId: string; gymName: string; isOwner: boolean }) {
  const [professor, setProfessor] = useState(false);
  return (
    <SheetForm title={professor ? 'Convidar professor' : 'Convidar alunos'}>
      <InviteCodesSection gymId={gymId} gymName={gymName} isOwner={isOwner} only={professor ? 'instructor' : 'student'} />
      {isOwner ? (
        <TextButton
          title={professor ? 'Voltar ao código de aluno' : 'Convidar professor'}
          // TODO(motion): content swapping between the two codes.
          onPress={() => setProfessor((p) => !p)}
        />
      ) : null}
    </SheetForm>
  );
}
