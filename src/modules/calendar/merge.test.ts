import { describe, expect, it } from 'vitest';
import { groupByDate, mergeDayEntries } from './merge';
import type { CalendarEvent, Note, Shift, ShiftType } from '../../db/types';

const morning: ShiftType = {
  id: 1, code: 'R', name: 'Ranní', start: '06:00', end: '14:00',
  breakMinutes: 30, paidBreak: false, color: '#f59e0b',
};
const types = new Map([[1, morning]]);
const label = () => 'Šichta';

const shift: Shift = { date: '2026-09-07', kind: 'work', typeId: 1 };
const event: CalendarEvent = { id: 1, date: '2026-09-07', start: '18:00', end: '20:00', title: 'Kino' };
const allDay: CalendarEvent = { id: 2, date: '2026-09-07', title: 'Narozeniny' };
const task: Note = {
  id: 3, title: 'Zaplatit nájem', body: '', tags: [], isTask: 1, done: 0,
  due: '2026-09-07', createdAt: 0, updatedAt: 0,
};

describe('mergeDayEntries', () => {
  it('sloučí šichtu, událost i úkol do jednoho seznamu', () => {
    const entries = mergeDayEntries([shift], [event], [task], types, label);
    expect(entries.map((e) => e.kind)).toEqual(['task', 'shift', 'event']);
    expect(entries[1].title).toBe('Ranní (R)');
    expect(entries[1].start).toBe('06:00');
    expect(entries[1].color).toBe('#f59e0b');
  });

  it('celodenní položky a úkoly jdou nad ty s časem', () => {
    const entries = mergeDayEntries([], [event, allDay], [task], types, label);
    expect(entries.map((e) => e.title)).toEqual(['Narozeniny', 'Zaplatit nájem', 'Kino']);
  });

  it('seřadí podle času v rámci dne a podle data mezi dny', () => {
    const later: CalendarEvent = { id: 4, date: '2026-09-08', start: '09:00', title: 'Doktor' };
    const entries = mergeDayEntries([shift], [later, event], [], types, label);
    expect(entries.map((e) => `${e.date} ${e.start}`)).toEqual([
      '2026-09-07 06:00', '2026-09-07 18:00', '2026-09-08 09:00',
    ]);
  });

  it('noční šichta má konec po půlnoci', () => {
    const night: ShiftType = { ...morning, id: 2, code: 'N', start: '22:00', end: '06:00' };
    const entries = mergeDayEntries(
      [{ date: '2026-09-07', kind: 'work', typeId: 2 }], [], [],
      new Map([[2, night]]), label,
    );
    expect(entries[0].start).toBe('22:00');
    expect(entries[0].end).toBe('06:00');
  });

  it('volno se ukáže bez času a s obecným popiskem', () => {
    const entries = mergeDayEntries([{ date: '2026-09-07', kind: 'off' }], [], [], types, label);
    expect(entries[0]).toMatchObject({ kind: 'shift', title: 'Šichta', start: undefined });
  });

  it('úkol bez termínu se do kalendáře nedostane', () => {
    const noDue: Note = { ...task, id: 9, due: undefined };
    expect(mergeDayEntries([], [], [noDue], types, label)).toEqual([]);
  });

  it('u hotového úkolu si pamatuje, že je odškrtnutý', () => {
    const entries = mergeDayEntries([], [], [{ ...task, done: 1 }], types, label);
    expect(entries[0].done).toBe(true);
  });
});

describe('groupByDate', () => {
  it('seskupí položky po dnech', () => {
    const entries = mergeDayEntries([shift], [event], [task], types, label);
    const grouped = groupByDate(entries);
    expect(grouped.size).toBe(1);
    expect(grouped.get('2026-09-07')).toHaveLength(3);
  });

  it('prázdný vstup dá prázdnou mapu', () => {
    expect(groupByDate([]).size).toBe(0);
  });
});
