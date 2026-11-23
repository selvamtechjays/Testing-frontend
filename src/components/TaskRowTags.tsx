import type { Tag } from '../api/types';
import { copy } from '../copy';
import type { CreateTagResult, TagsStatus } from '../tasks/tasksContext';
import { PanelToggleButton } from './PanelToggleButton';
import type { PanelButtonProps } from './useRowPanel';

/** How the list drives this row's tags picker; a row given none shows no Tags button. */
export interface RowTags {
  /** This row's picker is the open one. */
  open: boolean;
  /** The Tags button was pressed: opens the picker, or closes it. */
  onToggle: () => void;
  /** Closes the picker (Escape). */
  onClose: () => void;
  tags: Tag[];
  tagsStatus: TagsStatus;
  onChangeTags: (id: string, tagIds: string[]) => Promise<boolean>;
  onCreate: (id: string, name: string) => Promise<CreateTagResult>;
  onRetryTags: () => void;
  /** A chip on this row was chosen: set the Tag filter to that tag. Absent, chips are plain text. */
  onSelect?: (tagId: string) => void;
}

export type TagsButtonProps = PanelButtonProps;

/** The Tags button: named for its task, and pointing at the picker while that is open. */
export function TagsButton({
  title,
  ...props
}: TagsButtonProps & { title: string; disabled: boolean }) {
  return (
    <PanelToggleButton {...props} label={copy.tagsButtonLabel(title)} text={copy.tagsButton} />
  );
}
