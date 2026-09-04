import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, Field, Input, Section, Select, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { addMonths, monthDays, todayIso, weekdayIndex } from '../../lib/date';
import { holidayName, isCzechHoliday } from '../../lib/czHolidays';
import { downloadIcs, type IcsEvent } from '../../lib/ics';
import { useShiftTypeMap } from '../shifts/data';
import { shiftInterval } from '../shifts/pay';
import { groupByDate, mergeDayEntries, shiftEntryTitleKey, type DayEntry } from './merge';
import type { CalendarEvent } from '../../db/types';

const WEEKDAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const KIND_DOTS: Record<DayEntry['kind'], string> = {
  shift: 'var(--color-accent)',
  event: 'var(--color-night)',
  task: 'var(--color-good)',
};

function EventEditor({ initial, onClose }: { initial: CalendarEvent; onClose: () => void }) {
  const { t } = useI18n();
  const [event, setEvent] = useState(initial);
  const [allDay, setAllDay] = useState(!initial.start);

  const set = <K extends keyof CalendarEvent>(key: K, value: CalendarEvent[K]) =>
    setEvent((prev) => ({ ...prev, [key]: value }));

  async function save() {
    await db.events.put({
      ...event,
      title: event.title.trim(),
      start: allDay ? undefined : event.start,
      end: allDay ? undefined : event.end,
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('calendar.newEvent')}>
      <div className="space-y-3">
        <Field label={t('calendar.eventTitle')}>
          <Input value={event.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={event.date} onChange={(e) => set('date', e.target.value)} />
        </Field>

        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          {t('calendar.allDay')}
        </label>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('calendar.start')}>
              <Input type="time" value={event.start ?? ''} onChange={(e) => set('start', e.target.value)} />
            </Field>
            <Field label={t('calendar.end')}>
              <Input type="time" value={event.end ?? ''} onChange={(e) => set('end', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label={t('common.note')}>
          <Input value={event.note ?? ''} onChange={(e) => set('note', e.target.value)} />
        </Field>

        <Field label={t('calendar.remind')}>
          <Select
            value={event.remindMinutesBefore ?? ''}
            onChange={(e) => set('remindMinutesBefore', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t('calendar.remindNone')}</option>
            <option value="10">{t('calendar.remind10')}</option>
            <option value="30">{t('calendar.remind30')}</option>
            <option value="60">{t('calendar.remind60')}</option>
            <option value="1440">{t('calendar.remind1440')}</option>
          </Select>
        </Field>
        {event.remindMinutesBefore !== undefined && (
          <p className="text-xs text-[var(--color-muted)]">{t('calendar.remindNote')}</p>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={!event.title.trim()} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        {event.id !== undefined && (
          <Button variant="danger" onClick={() => void db.events.delete(event.id!).then(onClose)}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export function CalendarPage() {
  const { t, lang } = useI18n();
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [selected, setSelected] = useState<string>(todayIso());
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const days = monthDays(month);
  const first = days[0];
  const last = days[days.length - 1];

  const shifts = useLiveQuery(() => db.shifts.where('date').between(first, last, true, true).toArray(), [month], []);
  const events = useLiveQuery(() => db.events.where('date').between(first, last, true, true).toArray(), [month], []);
  const tasks = useLiveQuery(() => db.notes.filter((n) => n.isTask === 1 && n.due !== undefined).toArray(), [], []);
  const types = useShiftTypeMap();

  const entries = useMemo(
    () => mergeDayEntries(
      shifts, events,
      tasks.filter((task) => task.due! >= first && task.due! <= last),
      types,
      (shift) => t(shiftEntryTitleKey(shift)),
    ),
    [shifts, events, tasks, types, first, last, t],
  );

  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const weekdays = lang === 'cs' ? WEEKDAYS_CS : WEEKDAYS_EN;
  const today = todayIso();
  const selectedEntries = byDate.get(selected) ?? [];

  function exportMonth() {
    const ics: IcsEvent[] = [];
    for (const shift of shifts) {
      const type = shift.typeId ? types.get(shift.typeId) : undefined;
      const interval = shiftInterval(shift, type);
      if (interval) {
        ics.push({
          uid: `shift-${shift.date}@all-round`,
          title: type ? `${type.name} (${type.code})` : t('calendar.shift'),
          start: interval.start, end: interval.end, description: shift.note,
        });
      }
    }
    for (const event of events) {
      ics.push({
        uid: `event-${event.id}@all-round`,
        title: event.title,
        description: event.note,
        start: event.start ? new Date(`${event.date}T${event.start}`) : event.date,
        end: event.end ? new Date(`${event.date}T${event.end}`) : undefined,
      });
    }
    downloadIcs(ics, `kalendar-${month}`, t('calendar.title'));
  }

  const monthLabel = new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    month: 'long', year: 'numeric',
  }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1));

  return (
    <>
      <PageHeader
        title={t('calendar.title')}
        action={
          <Button variant="primary" onClick={() => setEditing({ date: selected, title: '' })}>+</Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="subtle" onClick={() => setMonth(addMonths(month, -1))}>←</Button>
        <button onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }} className="text-lg font-semibold first-letter:uppercase">
          {monthLabel}
        </button>
        <Button variant="subtle" onClick={() => setMonth(addMonths(month, 1))}>→</Button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] text-[var(--color-muted)]">
        {weekdays.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: weekdayIndex(first) }, (_, i) => <span key={`b${i}`} />)}
        {days.map((date) => {
          const dayEntries = byDate.get(date) ?? [];
          const kinds = [...new Set(dayEntries.map((e) => e.kind))];
          const holiday = isCzechHoliday(date);
          const weekend = weekdayIndex(date) >= 5;
          return (
            <button
              key={date}
              onClick={() => setSelected(date)}
              title={holidayName(date, lang)}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition ${
                selected === date
                  ? 'border-2 border-[var(--color-accent)]'
                  : date === today
                    ? 'border-[var(--color-accent)]'
                    : 'border-[var(--color-border)]'
              }`}
            >
              <span className={`text-xs ${weekend || holiday ? 'text-[var(--color-bad)]' : ''}`}>
                {Number(date.slice(8))}
              </span>
              <span className="flex h-1.5 gap-0.5">
                {kinds.map((kind) => (
                  <span key={kind} className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_DOTS[kind] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <Section
        title={t('calendar.dayDetail')}
        action={<Button variant="ghost" onClick={exportMonth}>📅 {t('calendar.exportMonth')}</Button>}
      >
        <Card>
          {selectedEntries.length === 0 ? (
            <p className="py-2 text-sm text-[var(--color-muted)]">{t('calendar.nothingToday')}</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {selectedEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-2.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: entry.color ?? KIND_DOTS[entry.kind] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${entry.done ? 'text-[var(--color-muted)] line-through' : ''}`}>
                      {entry.title}
                    </span>
                    {entry.note && <span className="block truncate text-xs text-[var(--color-muted)]">{entry.note}</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-[var(--color-muted)] tabular-nums">
                    {entry.start ? `${entry.start}${entry.end ? `–${entry.end}` : ''}` : t('calendar.allDay')}
                    <span className="block">
                      {entry.kind === 'shift' ? t('calendar.shift')
                        : entry.kind === 'task' ? t('calendar.task')
                        : t('calendar.event')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="mt-2 px-1 text-xs text-[var(--color-muted)]">{t('calendar.legend')}</p>
      </Section>

      {editing && <EventEditor initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
