import { createElement } from 'react';
import { registerModule } from '../registry';
import { MusicPage } from './MusicPage';

registerModule({
  id: 'music',
  titleKey: 'nav.music',
  path: 'music',
  icon: '🎵',
  order: 40,
  routes: [{ path: '/music', element: createElement(MusicPage) }],
});
