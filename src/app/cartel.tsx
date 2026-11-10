import { CartelScreen } from '@screens/competition/FightRecord';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(CartelScreen, 'Cartel');
