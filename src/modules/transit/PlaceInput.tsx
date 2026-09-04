import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Input } from '../../components/ui';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { geocode, modeIcon, type GeocodeResult } from './api';

export interface SelectedPlace {
  name: string;
  lat: number;
  lon: number;
  stopId?: string;
}

export function PlaceInput({
  label, value, onChange,
}: {
  label: string;
  value: SelectedPlace | null;
  onChange: (place: SelectedPlace | null) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const query = useDebounced(text, 300);

  const { data: results, loading, error } = useAsync(
    () => geocode(query),
    [query],
    open && query.trim().length >= 2,
  );

  function pick(hit: GeocodeResult) {
    onChange({ name: hit.name, lat: hit.lat, lon: hit.lon, stopId: hit.stopId });
    setText(hit.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </span>
      <Input
        value={text}
        placeholder={t('transit.searchStop')}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && query.trim().length >= 2 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          {loading && <li className="px-3 py-3 text-sm text-[var(--color-muted)]">{t('app.loading')}</li>}
          {!loading && error && (
            <li className="px-3 py-3 text-sm text-[var(--color-warn)]">
              {error.message === 'offline' ? t('app.needsInternet') : error.message}
            </li>
          )}
          {!loading && !error && results?.length === 0 && (
            <li className="px-3 py-3 text-sm text-[var(--color-muted)]">{t('common.none')}</li>
          )}
          {results?.map((hit) => (
            <li key={hit.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
              >
                <span className="text-lg">{hit.modes?.[0] ? modeIcon(hit.modes[0]) : '📍'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{hit.name}</span>
                  {hit.area && (
                    <span className="block truncate text-xs text-[var(--color-muted)]">{hit.area}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
