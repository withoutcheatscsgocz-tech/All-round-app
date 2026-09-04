import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card, Pill } from '../../components/ui';
import { todayIso } from '../../lib/date';

export function NotesCard() {
  const { t } = useI18n();
  const today = todayIso();

  const tasks = useLiveQuery(
    () => db.notes.filter((n) => n.isTask === 1 && n.done === 0).toArray(),
    [],
    [],
  );

  const overdue = tasks.filter((n) => n.due !== undefined && n.due < today);
  const dueToday = tasks.filter((n) => n.due === today);
  const shown = [...overdue, ...dueToday];

  if (shown.length === 0) return null;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">✅ {t('notes.tasksToday')}</h3>
        <Link to="/notes" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
      </div>

      <ul className="divide-y divide-[var(--color-border)]">
        {shown.slice(0, 5).map((note) => (
          <li key={note.id} className="flex items-center gap-3 py-1.5">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0"
              onChange={() => void db.notes.update(note.id!, { done: 1, updatedAt: Date.now() })}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{note.title}</span>
            {note.due !== undefined && note.due < today && (
              <Pill tone="warn">{t('notes.overdue')}</Pill>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
