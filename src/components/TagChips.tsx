import type { TaskTag } from '../api/types';
import './TagChips.css';

interface TagChipsProps {
  tags: TaskTag[];
  /** Chips become buttons that pick the tag as the filter; plain text for an unsaved or leaving row. */
  selectable?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * A row's tags as small named chips. The name is always the visible text, never markup; a long
 * name is cut with an ellipsis by CSS while the DOM text and the tooltip keep the whole of it.
 * A selectable chip is a real button that sets the Tag filter to its tag; it is not a toggle.
 */
export function TagChips({ tags, selectable = false, onSelect }: TagChipsProps) {
  if (tags.length === 0) return null;
  return (
    <span className="tag-chips">
      {tags.map((tag) => {
        const classes = `tag-chip tag-chip--${tag.colour}`;
        if (selectable && onSelect) {
          return (
            <button
              key={tag.id}
              type="button"
              className={`${classes} tag-chip--button`}
              title={tag.name}
              onClick={() => onSelect(tag.id)}
            >
              {tag.name}
            </button>
          );
        }
        return (
          <span key={tag.id} className={classes} title={tag.name}>
            {tag.name}
          </span>
        );
      })}
    </span>
  );
}
