import type { Task } from '../api/types';
import { tagsPanelId } from '../lib/notesPanelId';
import type { RowTags } from './TaskRowTags';
import { TaskTagsPanel } from './TaskTagsPanel';
import { useRowPanel } from './useRowPanel';

/**
 * The Tags button and the picker under the row. Leaving the picker by Escape or the button hands
 * focus back to the button; being closed because another row opened does not.
 */
export function useTagsRow(task: Task, tags: RowTags | undefined) {
  const { shown, handBack, button } = useRowPanel(
    tags?.open ?? false,
    tagsPanelId(task.id),
    tags?.onToggle,
  );
  if (!tags) return { tagsButton: null, tagsPanel: null };
  const tagsPanel = shown.map(({ item, leaving }) => (
    <TaskTagsPanel
      key={item.id}
      task={task}
      tags={tags.tags}
      tagsStatus={tags.tagsStatus}
      leaving={leaving}
      onToggle={(tagId) => {
        const ids = task.tags.map((tag) => tag.id);
        const next = ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId];
        void tags.onChangeTags(task.id, next);
      }}
      onCreate={(name) => tags.onCreate(task.id, name)}
      onRetryTags={tags.onRetryTags}
      onClose={() => {
        handBack();
        tags.onClose();
      }}
    />
  ));
  return { tagsButton: button, tagsPanel };
}
