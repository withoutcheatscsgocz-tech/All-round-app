import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, Field, Input, Section, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { todayIso } from '../../lib/date';
import { expandPattern } from './pay';
import { putShift, seedDefaultShiftTypes, usePayConfig, useShiftTypes } from './data';
import type { PayConfig, ShiftPattern, ShiftType } from '../../db/types';

const COLORS = ['#f59e0b', '#3b6ef5', '#6d5bd0', '#16a34a', '#dc2626', '#0891b2', '#db2777'];

const EMPTY_TYPE: ShiftType = {
  code: '', name: '', start: '06:00', end: '14:00',
  breakMinutes: 30, paidBreak: false, color: COLORS[0],
};

function TypeEditor({ initial, onDone }: { initial: ShiftType; onDone: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState(initial);

  const set = <K extends keyof ShiftType>(key: K, value: ShiftType[K]) =>
    setType((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('shifts.code')}>
          <Input value={type.code} maxLength={4} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label={t('common.name')}>
            <Input value={type.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t('shifts.start')}>
          <Input type="time" value={type.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field label={t('shifts.end')}>
          <Input type="time" value={type.end} onChange={(e) => set('end', e.target.value)} />
        </Field>
        <Field label={t('shifts.breakMinutes')}>
          <Input
            type="number"
            inputMode="numeric"
            value={type.breakMinutes}
            onChange={(e) => set('breakMinutes', Number(e.target.value))}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={type.paidBreak}
          onChange={(e) => set('paidBreak', e.target.checked)}
        />
        {t('shifts.paidBreak')}
      </label>

      <Field label={t('shifts.color')}>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => set('color', c)}
              style={{ background: c }}
              className={`h-9 w-9 rounded-full transition ${
                type.color === c ? 'ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-surface)]' : ''
              }`}
              aria-label={c}
            />
          ))}
        </div>
      </Field>

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={!type.code.trim() || !type.name.trim()}
          onClick={() => {
            void db.shiftTypes.put(type).then(onDone);
          }}
        >
          {t('common.save')}
        </Button>
        {type.id !== undefined && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t('common.confirmDelete'))) void db.shiftTypes.delete(type.id!).then(onDone);
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    </div>
  );
}

function PatternEditor({ initial, onDone }: { initial: ShiftPattern; onDone: () => void }) {
  const { t } = useI18n();
  const types = useShiftTypes();
  const [pattern, setPattern] = useState(initial);
  const [applyFrom, setApplyFrom] = useState(todayIso());
  const [applyDays, setApplyDays] = useState(60);
  const [overwrite, setOverwrite] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  function addSlot(slot: number | 'off') {
    setPattern((p) => ({ ...p, sequence: [...p.sequence, slot] }));
  }

  async function apply() {
    const generated = expandPattern(pattern.sequence, pattern.anchorDate, applyFrom, applyDays);
    let written = 0;
    for (const shift of generated) {
      if (!overwrite) {
        const existing = await db.shifts.where('date').equals(shift.date).first();
        if (existing) continue;
      }
      await putShift(shift);
      written += 1;
    }
    setStatus(t('shifts.applyDone', { count: written }));
  }

  return (
    <div className="space-y-4">
      <Field label={t('common.name')}>
        <Input value={pattern.name} onChange={(e) => setPattern((p) => ({ ...p, name: e.target.value }))} />
      </Field>

      <Field label={t('shifts.sequence')}>
        <div className="mb-2 flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--color-border)] p-2">
          {pattern.sequence.length === 0 && (
            <span className="px-1 text-sm text-[var(--color-muted)]">{t('common.empty')}</span>
          )}
          {pattern.sequence.map((slot, i) => {
            const type = slot === 'off' ? undefined : types.find((ty) => ty.id === slot);
            return (
              <button
                key={i}
                onClick={() => setPattern((p) => ({ ...p, sequence: p.sequence.filter((_, j) => j !== i) }))}
                className="rounded-lg px-2 py-1 text-xs font-bold text-white"
                style={{ background: type?.color ?? 'var(--color-muted)' }}
                title={t('common.delete')}
              >
                {type?.code ?? '–'}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {types.map((ty) => (
            <Button key={ty.id} variant="subtle" onClick={() => addSlot(ty.id!)}>
              + {ty.code}
            </Button>
          ))}
          <Button variant="subtle" onClick={() => addSlot('off')}>+ {t('shifts.kindOff')}</Button>
        </div>
      </Field>

      <Field label={t('shifts.anchorDate')}>
        <Input
          type="date"
          value={pattern.anchorDate}
          onChange={(e) => setPattern((p) => ({ ...p, anchorDate: e.target.value }))}
        />
      </Field>

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={!pattern.name.trim() || pattern.sequence.length === 0}
          onClick={() => void db.shiftPatterns.put(pattern).then(onDone)}
        >
          {t('common.save')}
        </Button>
        {pattern.id !== undefined && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t('common.confirmDelete'))) void db.shiftPatterns.delete(pattern.id!).then(onDone);
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('shifts.applyFrom')}>
            <Input type="date" value={applyFrom} onChange={(e) => setApplyFrom(e.target.value)} />
          </Field>
          <Field label={t('shifts.applyDays')}>
            <Input
              type="number"
              inputMode="numeric"
              value={applyDays}
              onChange={(e) => setApplyDays(Number(e.target.value))}
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          {t('shifts.applyOverwrite')}
        </label>
        <Button
          className="mt-3 w-full"
          disabled={pattern.sequence.length === 0}
          onClick={() => void apply()}
        >
          ⚡ {t('shifts.apply')}
        </Button>
        {status && <p className="mt-2 text-sm text-[var(--color-good)]">{status}</p>}
      </div>
    </div>
  );
}

function PayForm() {
  const { t } = useI18n();
  const [config, save] = usePayConfig();

  const set = <K extends keyof PayConfig>(key: K, value: PayConfig[K]) =>
    save({ ...config, [key]: value });

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('shifts.hourlyRate')}>
          <Input
            type="number" inputMode="decimal" value={config.hourlyRate}
            onChange={(e) => set('hourlyRate', num(e.target.value))}
          />
        </Field>
        <Field label={t('shifts.monthlyNorm')}>
          <Input
            type="number" inputMode="decimal" value={config.monthlyNormHours}
            onChange={(e) => set('monthlyNormHours', num(e.target.value))}
          />
        </Field>
        <Field label={t('shifts.nightPct')}>
          <Input type="number" inputMode="decimal" value={config.nightPct}
            onChange={(e) => set('nightPct', num(e.target.value))} />
        </Field>
        <Field label={t('shifts.weekendPct')}>
          <Input type="number" inputMode="decimal" value={config.weekendPct}
            onChange={(e) => set('weekendPct', num(e.target.value))} />
        </Field>
        <Field label={t('shifts.holidayPct')}>
          <Input type="number" inputMode="decimal" value={config.holidayPct}
            onChange={(e) => set('holidayPct', num(e.target.value))} />
        </Field>
        <Field label={t('shifts.overtimePct')}>
          <Input type="number" inputMode="decimal" value={config.overtimePct}
            onChange={(e) => set('overtimePct', num(e.target.value))} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted)]">{t('shifts.legalMinimums')}</p>

      <label className="mt-4 flex items-center gap-3 border-t border-[var(--color-border)] pt-4 text-sm">
        <input
          type="checkbox" className="h-4 w-4" checked={config.netEstimate.enabled}
          onChange={(e) => set('netEstimate', { ...config.netEstimate, enabled: e.target.checked })}
        />
        {t('shifts.netEstimate')}
      </label>

      {config.netEstimate.enabled && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={t('shifts.taxPct')}>
              <Input type="number" inputMode="decimal" value={config.netEstimate.taxPct}
                onChange={(e) => set('netEstimate', { ...config.netEstimate, taxPct: num(e.target.value) })} />
            </Field>
            <Field label={t('shifts.taxCredit')}>
              <Input type="number" inputMode="decimal" value={config.netEstimate.taxCreditMonthly}
                onChange={(e) => set('netEstimate', { ...config.netEstimate, taxCreditMonthly: num(e.target.value) })} />
            </Field>
            <Field label={t('shifts.socialPct')}>
              <Input type="number" inputMode="decimal" value={config.netEstimate.socialPct}
                onChange={(e) => set('netEstimate', { ...config.netEstimate, socialPct: num(e.target.value) })} />
            </Field>
            <Field label={t('shifts.healthPct')}>
              <Input type="number" inputMode="decimal" value={config.netEstimate.healthPct}
                onChange={(e) => set('netEstimate', { ...config.netEstimate, healthPct: num(e.target.value) })} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">{t('shifts.netDisclaimer')}</p>
        </>
      )}
    </Card>
  );
}

export function ShiftSettingsPage() {
  const { t } = useI18n();
  const types = useShiftTypes();
  const patterns = useLiveQuery(() => db.shiftPatterns.toArray(), [], []);
  const [editType, setEditType] = useState<ShiftType | null>(null);
  const [editPattern, setEditPattern] = useState<ShiftPattern | null>(null);

  return (
    <>
      <PageHeader
        title={t('shifts.settings')}
        action={<Link to="/shifts" className="text-sm text-[var(--color-accent)]">{t('common.back')}</Link>}
      />

      <Section
        title={t('shifts.types')}
        action={<Button variant="ghost" onClick={() => setEditType({ ...EMPTY_TYPE })}>+ {t('shifts.addType')}</Button>}
      >
        <p className="mb-3 px-1 text-sm text-[var(--color-muted)]">{t('shifts.typesHint')}</p>
        <div className="space-y-2">
          {types.map((ty) => (
            <Card key={ty.id} onClick={() => setEditType(ty)}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ background: ty.color }}
                >
                  {ty.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{ty.name}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {ty.start}–{ty.end} · {t('shifts.breakMinutes')} {ty.breakMinutes}
                    {ty.paidBreak ? ` (${t('shifts.paidBreak').toLowerCase()})` : ''}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {types.length === 0 && (
            <Button className="w-full" onClick={() => void seedDefaultShiftTypes()}>
              ✨ Ranní / Odpolední / Noční / Denní 12h
            </Button>
          )}
        </div>
      </Section>

      <Section
        title={t('shifts.patterns')}
        action={
          <Button
            variant="ghost"
            onClick={() => setEditPattern({ name: '', sequence: [], anchorDate: todayIso() })}
          >
            + {t('shifts.addPattern')}
          </Button>
        }
      >
        <p className="mb-3 px-1 text-sm text-[var(--color-muted)]">{t('shifts.patternsHint')}</p>
        <div className="space-y-2">
          {patterns.map((p) => (
            <Card key={p.id} onClick={() => setEditPattern(p)}>
              <p className="font-medium">{p.name}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.sequence.map((slot, i) => {
                  const type = slot === 'off' ? undefined : types.find((ty) => ty.id === slot);
                  return (
                    <span
                      key={i}
                      className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                      style={{ background: type?.color ?? 'var(--color-muted)' }}
                    >
                      {type?.code ?? '–'}
                    </span>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={t('shifts.pay')}>
        <PayForm />
      </Section>

      {editType && (
        <Sheet open onClose={() => setEditType(null)} title={t('shifts.types')}>
          <TypeEditor initial={editType} onDone={() => setEditType(null)} />
        </Sheet>
      )}
      {editPattern && (
        <Sheet open onClose={() => setEditPattern(null)} title={t('shifts.patterns')}>
          <PatternEditor initial={editPattern} onDone={() => setEditPattern(null)} />
        </Sheet>
      )}
    </>
  );
}
