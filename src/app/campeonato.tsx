import { StudentChampionshipScreen } from '@screens/championship/StudentChampionshipScreen';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(StudentChampionshipScreen, 'Campeonato');
