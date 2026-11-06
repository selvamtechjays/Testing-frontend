import type { ReactNode } from 'react';

interface StatusMessageProps {
  kind: 'status' | 'alert';
  children: ReactNode;
}

/** Confirmations use role="status"; errors use role="alert". */
export function StatusMessage({ kind, children }: StatusMessageProps) {
  return (
    <p role={kind} className={`message message-${kind}`}>
      {children}
    </p>
  );
}
