import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card, Pill } from '../../components/ui';
import { addDays, formatDuration, todayIso } from '../../lib/date';
import { shiftHours, shiftInterval, summariseMonth } from './pay';
import { usePayConfig, useShiftTypeMap } from './data';
import type { Shift, ShiftType } from '../../db/types';

function ShiftLine({ label, shift, type, lang }: {
  label: string;
  shift?: Shift;
  type?: ShiftType;
  lang: 'cs' | 'en';
}) {
  const { t } = useI18n();
  if (!shift || shift.kind === 'off') {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        <span className="text-sm">{shift ? t('shifts.kindOff') : '—'}</span>
      </div>
    );
  }

  if (shift.kind !== 'work') {
    const kindLabel =
      shift.kind === 'vacation' ? t('shifts.kindVacation')
      : shift.kind === 'sick' ? t('shifts.kindSick')
      : t('shifts.kindOther');
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        <Pill tone="good">{kindLabel}</Pill>
      </div>
    );
  }

  const interval = shiftInterval(shift, type);
  const hours = shiftHours(shift, type);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--color-muted)]">{label}</span>
      <span className="flex items-center gap-2">
        {type && (
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
            style={{ background: type.color }}
          >
            {type.code}
          </span>
        )}
        <span className="font-semibold tabular-nums">
          {shift.startOverride ?? type?.start}–{shift.endOverride ?? type?.end}
        </span>
        {interval && (
          <span className="text-xs text-[var(--color-muted)]">
            {formatDuration(hours.workedMinutes, lang)}
          </span>
        )}
      </span>
    </div>
  );
}

export function ShiftsCard() {
  const { t, lang } = useI18n();
  const today = todayIso();
  const tomorrow = addDays(today, 1);
  const month = today.slice(0, 7);

  const types = useShiftTypeMap();
  const [config] = usePayConfig();
  const shifts = useLiveQuery(
    () => db.shifts.where('date').between(`${month}-00`, `${month}-99`).toArray(),
    [month],
    [],
  );

  const todayShift = shifts.find((s) => s.date === today);
  const tomorrowShift = shifts.find((s) => s.date === tomorrow);
  const summary = summariseMonth(shifts, types, config);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">🗓️ {t('shifts.title')}</h3>
        <Link to="/shifts" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
      </div>

      <ShiftLine
        label={t('common.today')}
        shift={todayShift}
        type={todayShift?.typeId ? types.get(todayShift.typeId) : undefined}
        lang={lang}
      />
      <ShiftLine
        label={t('common.tomorrow')}
        shift={tomorrowShift}
        type={tomorrowShift?.typeId ? types.get(tomorrowShift.typeId) : undefined}
        lang={lang}
      />

      {summary.workedHours > 0 && (
        <p className="mt-2 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-muted)]">
          {t('shifts.hoursThisMonth', { hours: summary.workedHours })}
        </p>
      )}
    </Card>
  );
}
