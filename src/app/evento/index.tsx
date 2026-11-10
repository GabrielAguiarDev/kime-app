import { EventDetailScreen } from '@screens/events/EventDetailScreen';
import { withFinanceGate } from '@screens/finance/StudentFinance';

export default withFinanceGate(EventDetailScreen, 'Evento');
