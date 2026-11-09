import { useEffect } from 'react';
import { copy } from '../copy';
import { Button } from './Button';
import './FailureNotice.css';

interface FailureNoticeProps {
  message: string | null;
  onDismiss: () => void;
}

/** The one failure-message region. Hidden when there is no message; Escape or Dismiss closes it. */
export function FailureNotice({ message, onDismiss }: FailureNoticeProps) {
  const visible = message !== null;

  // Escape closes the message wherever focus is, while it is showing.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;
  return (
    <div role="alert" className="failure-notice message message-alert">
      <span className="failure-notice-text">{message}</span>
      <Button variant="quiet" className="failure-notice-dismiss" onClick={onDismiss}>
        {copy.dismiss}
      </Button>
    </div>
  );
}
