import { createElement } from 'react';
import { registerModule } from '../registry';
import { WatchPage } from './WatchPage';
import { WatchDetail } from './WatchDetail';
import { WatchCard } from './WatchCard';

registerModule({
  id: 'watch',
  titleKey: 'nav.watch',
  path: 'watch',
  icon: '🎬',
  order: 50,
  routes: [
    { path: '/watch', element: createElement(WatchPage) },
    { path: '/watch/:kind/:id', element: createElement(WatchDetail) },
  ],
  DashboardCard: WatchCard,
});
