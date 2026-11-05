import { ClassesScreen } from '@screens/app/ClassesScreen';
import { StaffClassesScreen } from '@screens/staff/StaffClassesScreen';
import { useActiveGym } from '@services/activeGym';

/** Aulas: the student's progress, or the staff's classes and attendance lists. */
export default function ClassesTab() {
  const { isStaff } = useActiveGym();
  return isStaff ? <StaffClassesScreen /> : <ClassesScreen />;
}
