import { withFinanceGate } from '@screens/finance/StudentFinance';
import { TrainingReportScreen } from '@screens/student/report/TrainingReportScreen';

export default withFinanceGate(TrainingReportScreen, 'Relatório de treinos');
