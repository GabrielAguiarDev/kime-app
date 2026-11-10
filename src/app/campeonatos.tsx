import { StudentChampionshipsScreen } from '@screens/championship/StudentChampionshipsScreen';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(StudentChampionshipsScreen, 'Campeonatos');
