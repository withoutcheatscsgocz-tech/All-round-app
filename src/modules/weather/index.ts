import { createElement } from 'react';
import { registerModule } from '../registry';
import { WeatherPage } from './WeatherPage';
import { WeatherCard } from './WeatherCard';

registerModule({
  id: 'weather',
  titleKey: 'nav.weather',
  path: 'weather',
  icon: '🌤️',
  order: 80,
  routes: [{ path: '/weather', element: createElement(WeatherPage) }],
  DashboardCard: WeatherCard,
});
