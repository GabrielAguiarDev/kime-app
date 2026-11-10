import { EventsScreen } from '@screens/events/EventsScreen';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(EventsScreen, 'Eventos');
