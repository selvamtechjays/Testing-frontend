import type { ChangeEvent, KeyboardEvent } from 'react';
import { copy } from '../copy';
import './TaskSearch.css';

/** Search text stops here; the server refuses more, and trims first, so this never blocks valid text. */
const SEARCH_MAX_LENGTH = 100;

interface TaskSearchProps {
  value: string;
  onChange: (text: string) => void;
}

/** Labelled search box. The native clear (x) and Escape both empty it, which restores the full list. */
export function TaskSearch({ value, onChange }: TaskSearchProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value !== '') onChange('');
  };
  return (
    <div className="card task-search">
      <div className="field task-search-field">
        <label htmlFor="task-search">{copy.searchLabel}</label>
        <input
          id="task-search"
          type="search"
          className="task-search-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={SEARCH_MAX_LENGTH}
          autoComplete="off"
        />
      </div>
    </div>
  );
}

/**
 * Reads the outcome of a search aloud. Always mounted, so a change of text is announced. It is a
 * polite live region without role="status": the Undo message owns that role on this page.
 */
export function SearchLiveRegion({ message }: { message: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="task-search-live">
      {message}
    </p>
  );
}
