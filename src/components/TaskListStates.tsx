import { copy } from '../copy';
import { Button } from './Button';
import { StatusMessage } from './StatusMessage';
import './TaskListStates.css';

const SKELETON_ROWS = 3;

/** Loading: the word for assistive tech and sighted users, plus placeholder rows shaped like tasks. */
export function TaskListLoading() {
  return (
    <div className="card task-list-loading" aria-busy="true">
      <p className="task-list-loading-text">{copy.tasksLoading}</p>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="task-list-skeleton" aria-hidden="true">
          <span className="task-list-skeleton-check" />
          <span className="task-list-skeleton-line" />
        </div>
      ))}
    </div>
  );
}

/** Empty: the first screen a new user sees, so it is designed — an illustration, a line, a pointer. */
export function TaskListEmpty() {
  return (
    <div className="card task-list-empty">
      <svg
        className="task-list-empty-icon"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="9" y="6" width="30" height="36" rx="4" />
        <path d="M17 18l3 3 6-6" />
        <path d="M17 30h14" />
      </svg>
      <p className="task-list-empty-text">{copy.tasksEmpty}</p>
    </div>
  );
}

/** No match: the list is fine, nothing in it contains the search text. The live region reads it aloud. */
export function TaskListNoMatch() {
  return (
    <div className="card task-list-empty task-list-no-match">
      <p className="task-list-empty-text">{copy.searchNoMatch}</p>
    </div>
  );
}

/** Search failed: the usual alert plus Retry, which runs the same query again. */
export function TaskListSearchFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="task-list-search-failed">
      <StatusMessage kind="alert">{copy.searchFailed}</StatusMessage>
      <Button variant="secondary" onClick={onRetry}>
        {copy.retry}
      </Button>
    </div>
  );
}

/** Filters match nothing: the list is fine, so offer the way back instead of a dead end. */
export function TaskListFilterNoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="card task-list-empty task-list-no-match">
      <p className="task-list-empty-text">{copy.filtersNoMatch}</p>
      <Button variant="secondary" onClick={onClear}>
        {copy.clearFilters}
      </Button>
    </div>
  );
}
