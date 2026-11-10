import { useModalities } from '@domain/Classes';
import { useGymMembers } from '@domain/Membership';
import { useActiveGym } from '@services/activeGym';

import { CartelScreen, type CartelEditRequest } from './FightRecord';
import { PreviousHistoryEditor } from './PreviousHistorySection';

/** Staff, Cartel of an athlete: the sheets that edit the history before the app. */
function StaffPreviousHistory({
  athleteId,
  modalityId,
  request,
  onRequestChange,
}: {
  athleteId: string;
  modalityId: string;
  request: CartelEditRequest | null;
  onRequestChange: (request: CartelEditRequest | null) => void;
}) {
  const { active, isStaff } = useActiveGym();
  const academyId = isStaff ? active?.gymId : undefined;
  const members = useGymMembers(academyId);
  const modalities = useModalities(academyId);
  const member = members.data?.find((m) => m.userId === athleteId && m.role === 'student');
  if (!academyId || !member || !modalities.data) return null;
  return (
    <PreviousHistoryEditor
      academyId={academyId}
      member={member}
      modalities={modalities.data}
      modalityId={modalityId}
      sheet={request}
      onSheetChange={onRequestChange}
    />
  );
}

/** Route /cartel: own Cartel, or (staff, with params) an athlete's, editable before the app. */
export function CartelRoute() {
  return <CartelScreen staffEditor={(ctx) => <StaffPreviousHistory {...ctx} />} />;
}
