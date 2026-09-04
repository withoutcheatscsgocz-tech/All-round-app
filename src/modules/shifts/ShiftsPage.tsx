import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, Pill, Section } from '../../components/ui';
import { addMonths, monthDays, round2, todayIso, weekdayIndex } from '../../lib/date';
import { holidayName, isCzechHoliday } from '../../lib/czHolidays';
import { downloadIcs, type IcsEvent } from '../../lib/ics';
import { shiftInterval, summariseMonth } from './pay';
import { useMonthShifts, usePayConfig, useShiftTypeMap } from './data';
import { DaySheet } from './DaySheet';
import type { Shift, ShiftType } from '../../db/types';

const WEEKDAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function currentMonth(): string {
  return todayIso().slice(0, 7);
}

function DayCell({
  date, shift, type, isToday, onClick,
}: {
  date: string;
  shift?: Shift;
  type?: ShiftType;
  isToday: boolean;
  onClick: () => void;
}) {
  const holiday = isCzechHoliday(date);
  const weekend = weekdayIndex(date) >= 5;
  const day = Number(date.slice(8));

  let label = '';
  let bg = 'transparent';
  let fg = 'var(--color-text)';

  if (shift?.kind === 'work' && type) {
    label = type.code;
    bg = type.color;
    fg = '#fff';
  } else if (shift?.kind === 'work') {
    label = '•';
    bg = 'var(--color-accent)';
    fg = '#fff';
  } else if (shift?.kind === 'vacation') { label = 'D'; bg = 'var(--color-good)'; fg = '#fff'; }
  else if (shift?.kind === 'sick') { label = 'N'; bg = 'var(--color-bad)'; fg = '#fff'; }
  else if (shift?.kind === 'off') { label = '–'; bg = 'var(--color-surface-2)'; fg = 'var(--color-muted)'; }

  return (
    <button
      onClick={onClick}
      title={holidayName(date) ?? undefined}
      className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-xs transition active:scale-95 ${
        isToday ? 'border-[var(--color-accent)] border-2' : 'border-[var(--color-border)]'
      }`}
    >
      <span className={`text-[10px] ${weekend || holiday ? 'text-[var(--color-bad)]' : 'text-[var(--color-muted)]'}`}>
        {day}
      </span>
      <span
        className="flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold"
        style={{ background: bg, color: fg }}
      >
        {label}
      </span>
      {holiday && <span className="absolute top-0.5 right-1 text-[8px]">★</span>}
    </button>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'muted' | 'strong' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={tone === 'muted' ? 'text-sm text-[var(--color-muted)]' : 'text-sm'}>{label}</span>
      <span className={tone === 'strong' ? 'text-lg font-bold' : 'font-medium tabular-nums'}>{value}</span>
    </div>
  );
}

export function ShiftsPage() {
  const { t, lang } = useI18n();
  const [month, setMonth] = useState(currentMonth);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const shifts = useMonthShifts(month);
  const types = useShiftTypeMap();
  const [config] = usePayConfig();

  const byDate = useMemo(() => new Map(shifts.map((s) => [s.date, s])), [shifts]);
  const summary = useMemo(() => summariseMonth(shifts, types, config), [shifts, types, config]);

  const days = monthDays(month);
  const leadingBlanks = weekdayIndex(days[0]);
  const weekdays = lang === 'cs' ? WEEKDAYS_CS : WEEKDAYS_EN;
  const today = todayIso();

  const money = new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0,
  });

  const monthLabel = new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1));

  function exportMonth() {
    const events: IcsEvent[] = [];
    for (const shift of shifts) {
      const type = shift.typeId ? types.get(shift.typeId) : undefined;
      const interval = shiftInterval(shift, type);
      if (interval) {
        events.push({
          uid: `shift-${shift.date}@all-round`,
          title: type ? `${type.name} (${type.code})` : t('shifts.kindWork'),
          description: shift.note,
          start: interval.start,
          end: interval.end,
        });
      } else if (shift.kind === 'vacation' || shift.kind === 'sick') {
        events.push({
          uid: `shift-${shift.date}@all-round`,
          title: shift.kind === 'vacation' ? t('shifts.kindVacation') : t('shifts.kindSick'),
          start: shift.date,
        });
      }
    }
    downloadIcs(events, `sichty-${month}`, t('shifts.title'));
  }

  return (
    <>
      <PageHeader
        title={t('shifts.title')}
        action={
          <Link to="/shifts/settings" className="text-2xl" aria-label={t('shifts.settings')}>
            ⚙️
          </Link>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="subtle" onClick={() => setMonth(addMonths(month, -1))} aria-label="←">←</Button>
        <button
          onClick={() => setMonth(currentMonth())}
          className="text-lg font-semibold first-letter:uppercase"
        >
          {monthLabel}
        </button>
        <Button variant="subtle" onClick={() => setMonth(addMonths(month, 1))} aria-label="→">→</Button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] text-[var(--color-muted)]">
        {weekdays.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mb-6 grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadingBlanks }, (_, i) => <span key={`b${i}`} />)}
        {days.map((date) => {
          const shift = byDate.get(date);
          return (
            <DayCell
              key={date}
              date={date}
              shift={shift}
              type={shift?.typeId ? types.get(shift.typeId) : undefined}
              isToday={date === today}
              onClick={() => setOpenDay(date)}
            />
          );
        })}
      </div>

      <Section
        title={t('shifts.summary')}
        action={
          <Button variant="ghost" onClick={exportMonth}>
            📅 {t('shifts.exportIcs')}
          </Button>
        }
      >
        <Card>
          <SummaryRow label={t('shifts.workedHours')} value={`${summary.workedHours} h`} tone="strong" />
          <div className="my-2 border-t border-[var(--color-border)]" />
          {summary.nightHours > 0 && <SummaryRow label={t('shifts.nightHours')} value={`${summary.nightHours} h`} tone="muted" />}
          {summary.weekendHours > 0 && <SummaryRow label={t('shifts.weekendHours')} value={`${summary.weekendHours} h`} tone="muted" />}
          {summary.holidayHours > 0 && <SummaryRow label={t('shifts.holidayHours')} value={`${summary.holidayHours} h`} tone="muted" />}
          {summary.overtimeHours > 0 && <SummaryRow label={t('shifts.overtimeHours')} value={`${summary.overtimeHours} h`} tone="muted" />}
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>{t('shifts.workDays')}: {summary.workDays}</Pill>
            {summary.vacationDays > 0 && <Pill tone="good">{t('shifts.vacationDays')}: {summary.vacationDays}</Pill>}
            {summary.sickDays > 0 && <Pill tone="warn">{t('shifts.sickDays')}: {summary.sickDays}</Pill>}
            {summary.offDays > 0 && <Pill>{t('shifts.offDays')}: {summary.offDays}</Pill>}
          </div>
        </Card>
      </Section>

      <Section title={t('shifts.pay')}>
        <Card>
          <SummaryRow label={t('shifts.grossPay')} value={money.format(summary.pay.gross)} tone="strong" />
          <div className="my-2 border-t border-[var(--color-border)]" />
          <SummaryRow label={t('shifts.base')} value={money.format(summary.pay.base)} tone="muted" />
          {summary.pay.night > 0 && <SummaryRow label={t('shifts.bonusNight')} value={money.format(summary.pay.night)} tone="muted" />}
          {summary.pay.weekend > 0 && <SummaryRow label={t('shifts.bonusWeekend')} value={money.format(summary.pay.weekend)} tone="muted" />}
          {summary.pay.holiday > 0 && <SummaryRow label={t('shifts.bonusHoliday')} value={money.format(summary.pay.holiday)} tone="muted" />}
          {summary.pay.overtime > 0 && <SummaryRow label={t('shifts.bonusOvertime')} value={money.format(summary.pay.overtime)} tone="muted" />}
          {summary.pay.net !== undefined && (
            <>
              <div className="my-2 border-t border-[var(--color-border)]" />
              <SummaryRow label={t('shifts.netPay')} value={money.format(summary.pay.net)} tone="strong" />
              <p className="mt-1 text-xs text-[var(--color-muted)]">{t('shifts.netDisclaimer')}</p>
            </>
          )}
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            {round2(summary.workedHours)} h × {money.format(config.hourlyRate)}
          </p>
        </Card>
      </Section>

      {openDay && (
        <DaySheet
          date={openDay}
          shift={byDate.get(openDay)}
          onClose={() => setOpenDay(null)}
        />
      )}
    </>
  );
}
