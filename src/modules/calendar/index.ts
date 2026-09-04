import { createElement } from 'react';
import { registerModule } from '../registry';
import { CalendarPage } from './CalendarPage';

registerModule({
  id: 'calendar',
  titleKey: 'nav.calendar',
  path: 'calendar',
  icon: '📅',
  order: 90,
  routes: [{ path: '/calendar', element: createElement(CalendarPage) }],
});
