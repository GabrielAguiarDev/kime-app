import { withFinanceGate } from '@screens/finance/StudentFinance';
import { ClassDetailsScreen } from '@screens/student/ClassDetailsScreen';

export default withFinanceGate(ClassDetailsScreen, 'Aula');
