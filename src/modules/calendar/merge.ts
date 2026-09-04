import type { CalendarEvent, Note, Shift, ShiftType } from '../../db/types';
import { shiftInterval } from '../shifts/pay';

export type EntryKind = 'shift' | 'event' | 'task';

export interface DayEntry {
  kind: EntryKind;
  id: string;
  date: string;
  /** 'HH:MM', chybí u celodenních položek a úkolů bez času. */
  start?: string;
  end?: string;
  title: string;
  note?: string;
  color?: string;
  done?: boolean;
}

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const KIND_LABELS = {
  work: 'shifts.kindWork',
  off: 'shifts.kindOff',
  vacation: 'shifts.kindVacation',
  sick: 'shifts.kindSick',
  holiday: 'shifts.kindHoliday',
  other: 'shifts.kindOther',
} as const;

export function shiftEntryTitleKey(shift: Shift) {
  return KIND_LABELS[shift.kind];
}

/**
 * Sloučí šichty, události a úkoly s termínem do jednoho seznamu na den.
 * Řadí se podle času; co čas nemá (celodenní, úkoly), jde nahoru.
 */
export function mergeDayEntries(
  shifts: Shift[],
  events: CalendarEvent[],
  tasks: Note[],
  types: Map<number, ShiftType>,
  shiftLabel: (shift: Shift) => string,
): DayEntry[] {
  const entries: DayEntry[] = [];

  for (const shift of shifts) {
    const type = shift.typeId ? types.get(shift.typeId) : undefined;
    const interval = shiftInterval(shift, type);
    entries.push({
      kind: 'shift',
      id: `shift-${shift.date}`,
      date: shift.date,
      start: interval ? clock(interval.start) : undefined,
      end: interval ? clock(interval.end) : undefined,
      title: type ? `${type.name} (${type.code})` : shiftLabel(shift),
      note: shift.note,
      color: type?.color,
    });
  }

  for (const event of events) {
    entries.push({
      kind: 'event',
      id: `event-${event.id}`,
      date: event.date,
      start: event.start,
      end: event.end,
      title: event.title,
      note: event.note,
      color: event.color,
    });
  }

  for (const task of tasks) {
    if (!task.due) continue;
    entries.push({
      kind: 'task',
      id: `task-${task.id}`,
      date: task.due,
      title: task.title,
      note: task.body || undefined,
      done: task.done === 1,
    });
  }

  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.start && b.start) return a.start.localeCompare(b.start);
    if (a.start) return 1;
    if (b.start) return -1;
    return a.title.localeCompare(b.title);
  });
}

/** Položky seskupené podle data — z toho se kreslí měsíční mřížka. */
export function groupByDate(entries: DayEntry[]): Map<string, DayEntry[]> {
  const map = new Map<string, DayEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.date);
    if (list) list.push(entry);
    else map.set(entry.date, [entry]);
  }
  return map;
}
