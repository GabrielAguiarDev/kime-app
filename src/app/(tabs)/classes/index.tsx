import { ClassesScreen } from '@screens/app/ClassesScreen';
import { withFinanceGate } from '@screens/finance/StudentFinance';
import { StaffClassesScreen } from '@screens/staff/StaffClassesScreen';
import { useActiveGym } from '@services/activeGym';

/** A blocked student (overdue fee, block on) sees the notice instead. */
const StudentClasses = withFinanceGate(ClassesScreen, 'Aulas', { tab: true });

/** Aulas: the student's progress, or the staff's classes and attendance lists. */
export default function ClassesTab() {
  const { isStaff } = useActiveGym();
  return isStaff ? <StaffClassesScreen /> : <StudentClasses />;
}
