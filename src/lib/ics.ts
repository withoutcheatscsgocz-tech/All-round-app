import type { IsoDate } from '../db/types';

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  /** Celodenní událost, když čas není zadaný. */
  start: Date | IsoDate;
  end?: Date | IsoDate;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Lokální čas bez zóny — kalendáře ho vezmou v pásmu zařízení. */
function formatDateTime(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

function formatDate(iso: IsoDate): string {
  return iso.replace(/-/g, '');
}

/** Escapuje text podle RFC 5545 — bez toho rozbije čárka nebo nový řádek celý soubor. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Řádky delší než 75 oktetů se musí zalomit, jinak je Google Kalendář odmítne. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    if (size + charSize > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charSize;
  }
  if (current) out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(events: IcsEvent[], calendarName = 'All-round app'): string {
  const stamp = formatDateTime(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//All-round app//CS//',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${stamp}`);

    if (typeof ev.start === 'string') {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(ev.start)}`);
      if (typeof ev.end === 'string') lines.push(`DTEND;VALUE=DATE:${formatDate(ev.end)}`);
    } else {
      lines.push(`DTSTART:${formatDateTime(ev.start)}`);
      if (ev.end instanceof Date) lines.push(`DTEND:${formatDateTime(ev.end)}`);
    }

    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

export function downloadIcs(events: IcsEvent[], filename: string, calendarName?: string): void {
  const blob = new Blob([buildIcs(events, calendarName)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
