'use client';

type StateKind = 'loading' | 'empty' | 'error' | 'forbidden';

type StatePanelProps = {
  kind: StateKind;
  title?: string;
  message?: string;
  action?: React.ReactNode;
};

const DEFAULTS: Record<StateKind, { title: string; message: string }> = {
  loading: { title: 'Loading', message: 'Fetching data…' },
  empty: { title: 'Nothing here yet', message: 'No records match this view.' },
  error: { title: 'Something went wrong', message: 'Unable to load data. Try again.' },
  forbidden: {
    title: 'Permission denied',
    message: 'Your role does not have access to this resource.'
  }
};

export function StatePanel({ kind, title, message, action }: StatePanelProps) {
  const defaults = DEFAULTS[kind];
  return (
    <div className={`padler-state-panel padler-state-panel--${kind}`} role="status">
      <div className="padler-state-panel__title">{title ?? defaults.title}</div>
      <p className="padler-state-panel__message">{message ?? defaults.message}</p>
      {action ? <div className="padler-state-panel__action">{action}</div> : null}
    </div>
  );
}
