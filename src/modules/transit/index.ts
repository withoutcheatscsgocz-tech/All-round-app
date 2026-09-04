import { createElement } from 'react';
import { registerModule } from '../registry';
import { TransitPage } from './TransitPage';
import { TransitCard } from './TransitCard';

registerModule({
  id: 'transit',
  titleKey: 'nav.transit',
  path: 'transit',
  icon: '🚌',
  order: 20,
  routes: [{ path: '/transit', element: createElement(TransitPage) }],
  DashboardCard: TransitCard,
});
