import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting } from '../../db/db';
import type { PayConfig, Shift, ShiftType } from '../../db/types';
import { DEFAULT_PAY_CONFIG } from './pay';
import { useEffect, useState } from 'react';

export const PAY_CONFIG_KEY = 'shifts.payConfig';

export function useShiftTypes(): ShiftType[] {
  return useLiveQuery(() => db.shiftTypes.toArray(), [], []);
}

export function useShiftTypeMap(): Map<number, ShiftType> {
  const types = useShiftTypes();
  return new Map(types.filter((t) => t.id !== undefined).map((t) => [t.id!, t]));
}

export function useMonthShifts(month: string): Shift[] {
  return useLiveQuery(
    () => db.shifts.where('date').between(`${month}-00`, `${month}-99`).toArray(),
    [month],
    [],
  );
}

export function usePayConfig(): [PayConfig, (next: PayConfig) => void] {
  const [config, setConfig] = useState<PayConfig>(DEFAULT_PAY_CONFIG);

  useEffect(() => {
    void getSetting<PayConfig>(PAY_CONFIG_KEY, DEFAULT_PAY_CONFIG).then((stored) =>
      // Doplní klíče, které v uložené konfiguraci ještě nebyly.
      setConfig({ ...DEFAULT_PAY_CONFIG, ...stored, netEstimate: { ...DEFAULT_PAY_CONFIG.netEstimate, ...stored.netEstimate } }),
    );
  }, []);

  const save = (next: PayConfig) => {
    setConfig(next);
    void setSetting(PAY_CONFIG_KEY, next);
  };

  return [config, save];
}

/** Zapíše nebo přepíše den. Datum je unikátní klíč, takže jeden den = jeden záznam. */
export async function putShift(shift: Shift): Promise<void> {
  const existing = await db.shifts.where('date').equals(shift.date).first();
  await db.shifts.put(existing?.id ? { ...shift, id: existing.id } : shift);
}

export async function clearShift(date: string): Promise<void> {
  await db.shifts.where('date').equals(date).delete();
}

/** Založí typické české směny, ať uživatel nezačíná na prázdné obrazovce. */
export async function seedDefaultShiftTypes(): Promise<void> {
  if ((await db.shiftTypes.count()) > 0) return;
  await db.shiftTypes.bulkAdd([
    { code: 'R', name: 'Ranní', start: '06:00', end: '14:00', breakMinutes: 30, paidBreak: false, color: '#f59e0b' },
    { code: 'O', name: 'Odpolední', start: '14:00', end: '22:00', breakMinutes: 30, paidBreak: false, color: '#3b6ef5' },
    { code: 'N', name: 'Noční', start: '22:00', end: '06:00', breakMinutes: 30, paidBreak: false, color: '#6d5bd0' },
    { code: 'D', name: 'Denní 12h', start: '06:00', end: '18:00', breakMinutes: 60, paidBreak: false, color: '#16a34a' },
  ]);
}
