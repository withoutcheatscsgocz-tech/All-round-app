import { createElement } from 'react';
import { registerModule } from '../registry';
import { NotesPage } from './NotesPage';
import { NotesCard } from './NotesCard';

registerModule({
  id: 'notes',
  titleKey: 'nav.notes',
  path: 'notes',
  icon: '✅',
  order: 60,
  routes: [{ path: '/notes', element: createElement(NotesPage) }],
  DashboardCard: NotesCard,
});
