import { registerModule } from '../registry';
import { DashboardPage } from './DashboardPage';
import { createElement } from 'react';

registerModule({
  id: 'dashboard',
  titleKey: 'nav.today',
  path: 'today',
  icon: '🏠',
  order: 0,
  routes: [
    { path: '/', element: createElement(DashboardPage) },
    { path: '/today', element: createElement(DashboardPage) },
  ],
});
