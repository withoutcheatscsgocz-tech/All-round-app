import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../i18n';
import { Button } from '../components/ui';

/** Lišta „je nová verze" — bez ní by uživatel na telefonu jel na staré verzi z cache. */
export function UpdatePrompt() {
  const t = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg">
      <span className="text-sm">{t('app.updateAvailable')}</span>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          {t('common.close')}
        </Button>
        <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
          {t('app.update')}
        </Button>
      </div>
    </div>
  );
}
