import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface FailureNoticeValue {
  /** Current failure text; null hides the region. */
  message: string | null;
  /** Shows a failure. A new message replaces the one on screen. */
  show: (message: string) => void;
  dismiss: () => void;
}

const FailureNoticeContext = createContext<FailureNoticeValue | null>(null);

/** Holds the single failure-message store the task list area renders (PAGE-TASK-01). */
export function FailureNoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((next: string) => setMessage(next), []);
  const dismiss = useCallback(() => setMessage(null), []);
  const value = useMemo(() => ({ message, show, dismiss }), [message, show, dismiss]);
  return <FailureNoticeContext.Provider value={value}>{children}</FailureNoticeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFailureNotice(): FailureNoticeValue {
  const value = useContext(FailureNoticeContext);
  if (!value) throw new Error('useFailureNotice must be used inside FailureNoticeProvider');
  return value;
}
