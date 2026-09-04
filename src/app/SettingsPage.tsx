import { useEffect, useRef, useState } from 'react';
import { PageHeader } from './Layout';
import { useAppSettings, wipeAllData, type Theme } from './SettingsProvider';
import { LANGS, useI18n } from '../i18n';
import { Button, Card, Field, Section, Select } from '../components/ui';
import { downloadBackup, exportBackup, importBackup } from '../db/backup';
import { requestPersistentStorage } from '../db/db';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useAppSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
    void navigator.storage?.estimate?.().then((e) =>
      setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }),
    );
  }, []);

  async function onExport() {
    downloadBackup(await exportBackup());
    setStatus(t('settings.exported'));
  }

  async function onImport(file: File) {
    if (!confirm(t('settings.importWarning'))) return;
    try {
      await importBackup(file);
      setStatus(t('settings.imported'));
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <Section title={t('settings.language')}>
        <Card>
          <Field label={t('settings.language')}>
            <Select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Select>
          </Field>
          <div className="mt-4">
            <Field label={t('settings.theme')}>
              <Select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                <option value="system">{t('settings.themeSystem')}</option>
                <option value="light">{t('settings.themeLight')}</option>
                <option value="dark">{t('settings.themeDark')}</option>
              </Select>
            </Field>
          </div>
        </Card>
      </Section>

      <Section title={t('settings.data')}>
        <Card>
          <p className="mb-4 text-sm text-[var(--color-muted)]">{t('settings.exportHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void onExport()}>
              ⬇︎ {t('settings.exportData')}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>⬆︎ {t('settings.importData')}</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = '';
              }}
            />
          </div>
          {status && <p className="mt-3 text-sm text-[var(--color-good)]">{status}</p>}
        </Card>
      </Section>

      <Section title={t('settings.storage')}>
        <Card>
          <p className="text-sm">
            {persisted === null
              ? '…'
              : persisted
                ? `✓ ${t('settings.storagePersisted')}`
                : `⚠︎ ${t('settings.storageNotPersisted')}`}
          </p>
          {usage && usage.quota > 0 && (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {t('settings.storageUsage', {
                used: formatBytes(usage.used),
                quota: formatBytes(usage.quota),
              })}
            </p>
          )}
          {persisted === false && (
            <Button
              className="mt-3"
              onClick={() => void requestPersistentStorage().then(setPersisted)}
            >
              {t('settings.requestPersist')}
            </Button>
          )}
        </Card>
      </Section>

      <Section title={t('settings.dangerZone')}>
        <Card>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t('settings.wipeConfirm'))) void wipeAllData();
            }}
          >
            {t('settings.wipe')}
          </Button>
        </Card>
      </Section>
    </>
  );
}
