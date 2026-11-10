import { CartelRoute } from '@screens/competition/CartelRoute';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(CartelRoute, 'Cartel');
