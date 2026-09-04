import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { Button, Field, Input, Select, Sheet } from '../../components/ui';
import { holidayName } from '../../lib/czHolidays';
import { formatDuration } from '../../lib/date';
import { clearShift, putShift, useShiftTypes } from './data';
import { shiftHours } from './pay';
import type { Shift, ShiftKind } from '../../db/types';

const KINDS: ShiftKind[] = ['work', 'off', 'vacation', 'sick', 'other'];

const KIND_LABELS = {
  work: 'shifts.kindWork',
  off: 'shifts.kindOff',
  vacation: 'shifts.kindVacation',
  sick: 'shifts.kindSick',
  holiday: 'shifts.kindHoliday',
  other: 'shifts.kindOther',
} as const;

export function DaySheet({
  date, shift, onClose,
}: {
  date: string;
  shift?: Shift;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const types = useShiftTypes();

  const [kind, setKind] = useState<ShiftKind>(shift?.kind ?? 'work');
  const [typeId, setTypeId] = useState<number | undefined>(shift?.typeId);
  const [custom, setCustom] = useState(Boolean(shift?.startOverride));
  const [start, setStart] = useState(shift?.startOverride ?? '');
  const [end, setEnd] = useState(shift?.endOverride ?? '');
  const [breakMin, setBreakMin] = useState(shift?.breakOverride?.toString() ?? '');
  const [note, setNote] = useState(shift?.note ?? '');

  // Když uživatel nemá vybraný typ, vezmi první — ať nezůstane prázdný výběr.
  useEffect(() => {
    if (kind === 'work' && typeId === undefined && types.length > 0) setTypeId(types[0].id);
  }, [kind, typeId, types]);

  const selectedType = types.find((ty) => ty.id === typeId);
  const draft: Shift = {
    date,
    kind,
    typeId: kind === 'work' ? typeId : undefined,
    startOverride: custom && start ? start : undefined,
    endOverride: custom && end ? end : undefined,
    breakOverride: custom && breakMin !== '' ? Number(breakMin) : undefined,
    note: note.trim() || undefined,
  };
  const preview = shiftHours(draft, selectedType);

  const dateLabel = new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(date));

  const holiday = holidayName(date, lang);

  async function save() {
    await putShift(draft);
    onClose();
  }

  async function remove() {
    await clearShift(date);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={dateLabel}>
      {holiday && <p className="mb-4 text-sm text-[var(--color-bad)]">★ {holiday}</p>}

      <div className="space-y-4">
        <Field label={t('shifts.kind')}>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  kind === k
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                }`}
              >
                {t(KIND_LABELS[k])}
              </button>
            ))}
          </div>
        </Field>

        {kind === 'work' && (
          <>
            {types.length === 0 ? (
              <p className="text-sm text-[var(--color-warn)]">{t('shifts.noTypes')}</p>
            ) : (
              <Field label={t('shifts.type')}>
                <Select value={typeId ?? ''} onChange={(e) => setTypeId(Number(e.target.value))}>
                  {types.map((ty) => (
                    <option key={ty.id} value={ty.id}>
                      {ty.code} · {ty.name} ({ty.start}–{ty.end})
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={custom}
                onChange={(e) => {
                  setCustom(e.target.checked);
                  if (e.target.checked && selectedType) {
                    setStart(start || selectedType.start);
                    setEnd(end || selectedType.end);
                    setBreakMin(breakMin || String(selectedType.breakMinutes));
                  }
                }}
                className="h-4 w-4"
              />
              {t('shifts.customTimes')}
            </label>

            {custom && (
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('shifts.start')}>
                  <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label={t('shifts.end')}>
                  <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </Field>
                <Field label={t('shifts.breakMinutes')}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={breakMin}
                    onChange={(e) => setBreakMin(e.target.value)}
                  />
                </Field>
              </div>
            )}

            {preview.workedMinutes > 0 && (
              <div className="rounded-xl bg-[var(--color-surface-2)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">{t('shifts.workedHours')}</span>
                  <span className="font-semibold">{formatDuration(preview.workedMinutes, lang)}</span>
                </div>
                {preview.nightMinutes > 0 && (
                  <div className="mt-1 flex justify-between">
                    <span className="text-[var(--color-muted)]">{t('shifts.nightHours')}</span>
                    <span>{formatDuration(preview.nightMinutes, lang)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Field label={t('common.note')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => void save()}>
          {t('common.save')}
        </Button>
        {shift && (
          <Button variant="danger" onClick={() => void remove()}>
            {t('shifts.clear')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
