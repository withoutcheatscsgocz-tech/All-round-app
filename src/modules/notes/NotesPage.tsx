import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Field, Input, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { todayIso } from '../../lib/date';
import type { Note } from '../../db/types';

const EMPTY: Note = {
  title: '', body: '', tags: [], isTask: 1, done: 0, createdAt: 0, updatedAt: 0,
};

function NoteEditor({ initial, onClose }: { initial: Note; onClose: () => void }) {
  const { t } = useI18n();
  const [note, setNote] = useState(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));

  const set = <K extends keyof Note>(key: K, value: Note[K]) =>
    setNote((prev) => ({ ...prev, [key]: value }));

  async function save() {
    const now = Date.now();
    await db.notes.put({
      ...note,
      title: note.title.trim(),
      tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
      createdAt: note.createdAt || now,
      updatedAt: now,
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={note.isTask ? t('notes.newTask') : t('notes.newNote')}>
      <div className="space-y-3">
        <Field label={t('notes.noteTitle')}>
          <Input value={note.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </Field>
        <Field label={t('notes.body')}>
          <textarea
            rows={4}
            value={note.body}
            onChange={(e) => set('body', e.target.value)}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 outline-none focus:border-[var(--color-accent)]"
          />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={note.isTask === 1}
            onChange={(e) => set('isTask', e.target.checked ? 1 : 0)}
          />
          {t('notes.isTask')}
        </label>
        {note.isTask === 1 && (
          <Field label={t('notes.due')}>
            <Input
              type="date"
              value={note.due ?? ''}
              onChange={(e) => set('due', e.target.value || undefined)}
            />
          </Field>
        )}
        <Field label={t('notes.tags')}>
          <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={!note.title.trim()} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        {note.id !== undefined && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t('common.confirmDelete'))) void db.notes.delete(note.id!).then(onClose);
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function TaskRow({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const { lang } = useI18n();
  const today = todayIso();
  const overdue = note.due !== undefined && note.due < today && note.done === 0;
  const dueToday = note.due === today;

  return (
    <li className="flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={note.done === 1}
        onChange={() => void db.notes.update(note.id!, { done: note.done ? 0 : 1, updatedAt: Date.now() })}
        className="mt-0.5 h-5 w-5 shrink-0"
      />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={`block ${note.done ? 'text-[var(--color-muted)] line-through' : ''}`}>
          {note.title}
        </span>
        {note.body && <span className="block truncate text-sm text-[var(--color-muted)]">{note.body}</span>}
        {note.due && (
          <span className={`text-xs ${overdue ? 'text-[var(--color-bad)]' : dueToday ? 'text-[var(--color-warn)]' : 'text-[var(--color-muted)]'}`}>
            {new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
              day: 'numeric', month: 'numeric',
            }).format(new Date(note.due))}
          </span>
        )}
      </button>
    </li>
  );
}

export function NotesPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'tasks' | 'notes'>('tasks');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [quick, setQuick] = useState('');

  const all = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), [], []);
  const today = todayIso();

  const tasks = all.filter((n) => n.isTask === 1 && (showDone || n.done === 0));
  const notes = all.filter((n) => n.isTask === 0);

  const overdue = tasks.filter((n) => n.due !== undefined && n.due < today && n.done === 0);
  const dueToday = tasks.filter((n) => n.due === today && n.done === 0);
  const rest = tasks.filter((n) => !overdue.includes(n) && !dueToday.includes(n));

  async function quickAdd() {
    if (!quick.trim()) return;
    const now = Date.now();
    await db.notes.add({
      title: quick.trim(), body: '', tags: [],
      isTask: tab === 'tasks' ? 1 : 0, done: 0,
      createdAt: now, updatedAt: now,
    });
    setQuick('');
  }

  const group = (title: string, list: Note[]) =>
    list.length > 0 && (
      <div className="mb-4">
        <h2 className="mb-1 px-1 text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
          {title}
        </h2>
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {list.map((note) => <TaskRow key={note.id} note={note} onOpen={() => setEditing(note)} />)}
          </ul>
        </Card>
      </div>
    );

  return (
    <>
      <PageHeader
        title={t('notes.title')}
        action={
          <Button variant="primary" onClick={() => setEditing({ ...EMPTY, isTask: tab === 'tasks' ? 1 : 0 })}>
            +
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        {(['tasks', 'notes'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm transition ${
              tab === id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
            }`}
          >
            {id === 'tasks' ? t('notes.tabTasks') : t('notes.tabNotes')}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void quickAdd(); }}
          placeholder={t('notes.quickAdd')}
        />
        <Button disabled={!quick.trim()} onClick={() => void quickAdd()}>+</Button>
      </div>

      {tab === 'tasks' ? (
        tasks.length === 0 ? (
          <EmptyState title={t('notes.noTasks')} />
        ) : (
          <>
            {group(t('notes.overdue'), overdue)}
            {group(t('notes.todayDue'), dueToday)}
            {group(t('notes.upcoming'), rest)}
            <label className="flex items-center gap-3 px-1 text-sm text-[var(--color-muted)]">
              <input type="checkbox" className="h-4 w-4" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              {t('notes.showDone')}
            </label>
          </>
        )
      ) : notes.length === 0 ? (
        <EmptyState title={t('notes.noNotes')} />
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Card key={note.id} onClick={() => setEditing(note)}>
              <p className="font-medium">{note.title}</p>
              {note.body && <p className="mt-0.5 line-clamp-3 text-sm text-[var(--color-muted)]">{note.body}</p>}
            </Card>
          ))}
        </div>
      )}

      {editing && <NoteEditor initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
