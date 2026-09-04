import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent)] text-white hover:opacity-90 active:opacity-80',
  subtle: 'bg-[var(--color-surface-2)] text-[var(--color-text)] hover:brightness-95',
  ghost: 'bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]',
  danger: 'bg-[var(--color-bad)] text-white hover:opacity-90',
};

export function Button({
  variant = 'subtle',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left ${
        onClick ? 'transition hover:brightness-[0.98] active:scale-[0.995]' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Input({ className = '', type = 'text', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 outline-none transition focus:border-[var(--color-accent)] ${className}`}
    />
  );
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 outline-none transition focus:border-[var(--color-accent)] ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-muted)] uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--color-muted)]">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-sm text-[var(--color-muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-bad)]/40 bg-[var(--color-bad)]/10 p-4">
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="subtle" className="mt-3" onClick={onRetry}>
          {retryLabel ?? 'Zkusit znovu'}
        </Button>
      )}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 pb-safe sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-[var(--color-muted)]" aria-label="Zavřít">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'night' }) {
  const tones = {
    neutral: 'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    good: 'bg-[var(--color-good)]/15 text-[var(--color-good)]',
    warn: 'bg-[var(--color-warn)]/15 text-[var(--color-warn)]',
    night: 'bg-[var(--color-night)]/15 text-[var(--color-night)]',
  };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
