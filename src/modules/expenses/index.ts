import { createElement } from 'react';
import { registerModule } from '../registry';
import { ExpensesPage } from './ExpensesPage';
import { ExpensesCard } from './ExpensesCard';

registerModule({
  id: 'expenses',
  titleKey: 'nav.expenses',
  path: 'expenses',
  icon: '💸',
  order: 70,
  routes: [{ path: '/expenses', element: createElement(ExpensesPage) }],
  DashboardCard: ExpensesCard,
});
