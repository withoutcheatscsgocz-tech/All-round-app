import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './SettingsProvider';
import { Layout } from './Layout';
import { SettingsPage } from './SettingsPage';
import { UpdatePrompt } from './UpdatePrompt';
import { getModules } from '../modules/registry';
import { PlayerProvider } from '../modules/music/player';
import { MiniPlayer } from '../modules/music/MiniPlayer';
import { handleRedirectCallback } from '../modules/music/spotify/auth';
import { isNativeApp } from '../lib/platform';
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
  const [authDone, setAuthDone] = useState(false);

  // Ve webu přijde návrat z přihlášení ke Spotify jako ?code=… v adrese.
  useEffect(() => {
    handleRedirectCallback()
      .catch(() => undefined)
      .finally(() => setAuthDone(true));
  }, []);

  // V APK adresa na stránku nedorazí — systém ji předá jako otevření odkazu
  // s vlastním schématem, takže se musí odchytnout tady.
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;

    void import('@capacitor/app').then(({ App: CapacitorApp }) =>
      CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        void handleRedirectCallback(url).catch(() => undefined);
      }).then((handle) => {
        remove = () => void handle.remove();
      }),
    );

    return () => remove?.();
  }, []);

  if (!authDone) return null;

  return (
    <SettingsProvider>
      <PlayerProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              {ModuleRoutes()}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={first ? `/${first.path}` : '/settings'} replace />} />
            </Route>
          </Routes>
          <MiniPlayer />
          <UpdatePrompt />
        </HashRouter>
      </PlayerProvider>
    </SettingsProvider>
  );
}
