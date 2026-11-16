import { copy } from '../copy';
import { Button } from './Button';
import './OverdueSummary.css';

interface OverdueSummaryProps {
  count: number;
  /** Selecting it shows just the overdue tasks. */
  onSelect: () => void;
}

/** "N overdue" as a real button above the list; hidden when nothing is overdue. */
export function OverdueSummary({ count, onSelect }: OverdueSummaryProps) {
  if (count <= 0) return null;
  return (
    <div className="overdue-summary">
      <Button variant="danger" onClick={onSelect}>
        {copy.overdueSummary(count)}
      </Button>
    </div>
  );
}
