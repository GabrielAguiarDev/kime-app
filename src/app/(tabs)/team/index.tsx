import { StudentTeamScreen } from '@screens/team/StudentTeamScreen';
import { TeamScreen } from '@screens/team/TeamScreen';
import { useActiveGym } from '@services/activeGym';

/** Equipe: management for staff; classmates and ranking for students. */
export default function TeamTab() {
  const { isStaff } = useActiveGym();
  return isStaff ? <TeamScreen /> : <StudentTeamScreen />;
}
