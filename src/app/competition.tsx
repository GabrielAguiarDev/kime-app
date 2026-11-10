import { CompetitionScreen } from '@screens/app/CompetitionScreen';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(CompetitionScreen, 'Competição');
