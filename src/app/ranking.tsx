import { withFinanceGate } from '@screens/finance/StudentFinance';
import { RankingScreen } from '@screens/ranking/RankingScreen';

export default withFinanceGate(RankingScreen, 'Ranking');
