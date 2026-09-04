import { createElement } from 'react';
import { registerModule } from '../registry';
import { RecipesPage } from './RecipesPage';
import { RecipeDetail } from './RecipeDetail';
import { ShoppingPage } from './ShoppingPage';
import { MealPlanPage } from './MealPlanPage';
import { RecipesCard } from './RecipesCard';

registerModule({
  id: 'recipes',
  titleKey: 'nav.recipes',
  path: 'recipes',
  icon: '🍳',
  order: 30,
  routes: [
    { path: '/recipes', element: createElement(RecipesPage) },
    { path: '/recipes/shopping', element: createElement(ShoppingPage) },
    { path: '/recipes/plan', element: createElement(MealPlanPage) },
    { path: '/recipes/:id', element: createElement(RecipeDetail) },
  ],
  DashboardCard: RecipesCard,
});
