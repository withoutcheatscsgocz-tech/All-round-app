import { createElement } from 'react';
import { registerModule } from '../registry';
import { ShiftsPage } from './ShiftsPage';
import { ShiftSettingsPage } from './ShiftSettingsPage';
import { ShiftsCard } from './ShiftsCard';

registerModule({
  id: 'shifts',
  titleKey: 'nav.shifts',
  path: 'shifts',
  icon: '🗓️',
  order: 10,
  routes: [
    { path: '/shifts', element: createElement(ShiftsPage) },
    { path: '/shifts/settings', element: createElement(ShiftSettingsPage) },
  ],
  DashboardCard: ShiftsCard,
});
