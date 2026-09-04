import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './SettingsProvider';
import { Layout } from './Layout';
import { SettingsPage } from './SettingsPage';
import { UpdatePrompt } from './UpdatePrompt';
import { getModules } from '../modules/registry';
import '../modules';

function ModuleRoutes() {
  return (
    <>
      {getModules().flatMap((m) =>
        m.routes.map((route, i) => (
          <Route key={`${m.id}-${i}`} path={route.path} element={route.element} />
        )),
      )}
    </>
  );
}

export function App() {
  const first = getModules()[0];
  return (
    <SettingsProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            {ModuleRoutes()}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={first ? `/${first.path}` : '/settings'} replace />} />
          </Route>
        </Routes>
        <UpdatePrompt />
      </HashRouter>
    </SettingsProvider>
  );
}
