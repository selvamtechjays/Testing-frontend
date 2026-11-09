import { copy } from '../copy';
import './UndoMessage.css';

/** Punctuation between the message and the Undo action, not a translatable phrase. */
const UNDO_SEPARATOR = ' - ';

interface UndoMessageProps {
  visible: boolean;
  onUndo: () => void;
}

/** "Task deleted - Undo": one action, announced politely, no countdown and no spinner. */
export function UndoMessage({ visible, onUndo }: UndoMessageProps) {
  if (!visible) return null;
  return (
    <div role="status" className="undo-message message message-status">
      <span>{copy.taskDeleted}</span>
      {UNDO_SEPARATOR}
      <button type="button" className="undo-message-action" onClick={onUndo}>
        {copy.undo}
      </button>
    </div>
  );
}
