import { useRef, useState, type RefObject } from 'react';
import { AddTaskForm } from '../components/AddTaskForm';
import { FailureNotice } from '../components/FailureNotice';
import { ManageTagsPanel } from '../components/ManageTagsPanel';
import { OverdueSummary } from '../components/OverdueSummary';
import { StatusMessage } from '../components/StatusMessage';
import { TaskFilterBar } from '../components/TaskFilterBar';
import { TaskList } from '../components/TaskList';
import { SearchLiveRegion, TaskSearch } from '../components/TaskSearch';
import {
  TaskListEmpty,
  TaskListFilterNoMatch,
  TaskListLoading,
  TaskListNoMatch,
  TaskListSearchFailed,
} from '../components/TaskListStates';
import { UndoMessage } from '../components/UndoMessage';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { filtersActive } from '../tasks/listFilters';
import { TasksProvider } from '../tasks/TasksProvider';
import type { ListStatus } from '../tasks/tasksContext';
import { useTasks } from '../tasks/useTasks';

/** The Manage tags panel, mounted only while it is open so it reads the tags afresh each time. */
function ManageTags({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tags, updateTag, deleteTag, freshTaskCount, refreshTags } = useTasks();
  if (!open) return null;
  return (
    <ManageTagsPanel
      tags={tags}
      onUpdate={updateTag}
      onDelete={deleteTag}
      onFreshCount={freshTaskCount}
      onRefresh={refreshTags}
      onClose={onClose}
    />
  );
}

interface BodyProps {
  /** The Manage tags panel is open; a row panel opening closes it. */
  managing: boolean;
  onRowPanelOpened: () => void;
}

function Body({ managing, onRowPanelOpened }: BodyProps) {
  const {
    tasks,
    status,
    today,
    filtersApplied,
    toggleStatus,
    editTitle,
    changeDueDate,
    changePriority,
    changeNotes,
    tags,
    tagsStatus,
    refreshTags,
    changeTags,
    createTagAndTick,
    selectTag,
    startDelete,
    retrySearch,
    clearFilters,
  } = useTasks();
  if (status === 'loading') return <TaskListLoading />;
  if (status === 'loadFailed')
    return <StatusMessage kind="alert">{copy.tasksLoadFailed}</StatusMessage>;
  if (status === 'searchFailed') return <TaskListSearchFailed onRetry={retrySearch} />;
  if (status === 'noMatch')
    return filtersApplied ? <TaskListFilterNoMatch onClear={clearFilters} /> : <TaskListNoMatch />;
  if (status === 'empty') return <TaskListEmpty />;
  return (
    <TaskList
      tasks={tasks}
      today={today}
      onToggle={toggleStatus}
      onEditTitle={editTitle}
      onChangeDueDate={changeDueDate}
      onChangePriority={changePriority}
      onChangeNotes={changeNotes}
      onDelete={startDelete}
      tags={tags}
      tagsStatus={tagsStatus}
      onChangeTags={changeTags}
      onCreateTag={createTagAndTick}
      onRetryTags={() => void refreshTags()}
      onSelectTag={selectTag}
      manageOpen={managing}
      onRowPanelOpened={onRowPanelOpened}
    />
  );
}

/** What a screen reader hears once a search or filter settles: the match count, or that nothing matched. */
function announcement(
  status: ListStatus,
  narrowed: { search: boolean; filters: boolean },
  searching: boolean,
  count: number,
): string {
  if (status === 'noMatch' && !searching) {
    return narrowed.filters ? copy.filtersNoMatch : copy.searchNoMatch;
  }
  if (status === 'populated' && (narrowed.search || narrowed.filters) && !searching) {
    return copy.searchResultCount(count);
  }
  return '';
}

interface FilterToolsProps {
  managing: boolean;
  onToggleManage: () => void;
  onCloseManage: () => void;
  manageRef: RefObject<HTMLButtonElement | null>;
}

/** Search, the filter bar (with its Manage tags button), the panel it opens, and the overdue summary. */
function FilterTools({ managing, onToggleManage, onCloseManage, manageRef }: FilterToolsProps) {
  const { search, setSearch, filters, setFilter, clearFilters, tags, overdueCount } = useTasks();
  // Overdue tasks are always pending, so the summary also clears a Completed status (DEC-234).
  const showOverdue = () => {
    setFilter('status', 'all');
    setFilter('due', 'overdue');
  };
  return (
    <>
      <TaskSearch value={search} onChange={setSearch} />
      <TaskFilterBar
        filters={filters}
        onChange={setFilter}
        onClear={clearFilters}
        active={filtersActive(filters)}
        tags={tags}
        manage={{ open: managing, onToggle: onToggleManage, ref: manageRef }}
      />
      <ManageTags open={managing} onClose={onCloseManage} />
      <OverdueSummary count={overdueCount} onSelect={showOverdue} />
    </>
  );
}

function Content() {
  const { tasks, status, addTask, deletePending, undoDelete } = useTasks();
  const { searching, searchApplied, filtersApplied, today } = useTasks();
  const { message, dismiss } = useFailureNotice();
  const [managing, setManaging] = useState(false);
  const manageRef = useRef<HTMLButtonElement>(null);
  const closeManage = () => {
    setManaging(false);
    manageRef.current?.focus();
  };
  // Only a list that loaded can take an add: while loading it would race the load, and after a
  // failed load or failed search an added task would never appear.
  const canAdd = status === 'empty' || status === 'populated' || status === 'noMatch';
  // Search and filters need a list to narrow: not during the first load, nor after it failed.
  const canSearch = status !== 'loading' && status !== 'loadFailed';
  return (
    <>
      <div className="page-header">
        <h1>{copy.homeHeading}</h1>
        <p className="page-intro">{copy.homeIntro}</p>
      </div>
      {canAdd ? <AddTaskForm onAdd={(task) => void addTask(task)} today={today} /> : null}
      {canSearch ? (
        <FilterTools
          managing={managing}
          onToggleManage={() => setManaging((was) => !was)}
          onCloseManage={closeManage}
          manageRef={manageRef}
        />
      ) : null}
      <SearchLiveRegion
        message={announcement(
          status,
          { search: searchApplied, filters: filtersApplied },
          searching,
          tasks.length,
        )}
      />
      <FailureNotice message={message} onDismiss={dismiss} />
      <UndoMessage visible={deletePending} onUndo={undoDelete} />
      <div aria-busy={searching}>
        <Body managing={managing} onRowPanelOpened={() => setManaging(false)} />
      </div>
    </>
  );
}

/**
 * The signed-in home (PAGE-TASK-01). Keyed by user so a different person never sees the previous
 * person's list: the providers remount and the in-memory list starts empty (AC-10).
 */
export function TaskListPage() {
  const { user } = useAuth();
  return (
    <FailureNoticeProvider key={user?.id ?? 'none'}>
      <TasksProvider userId={user?.id}>
        <Content />
      </TasksProvider>
    </FailureNoticeProvider>
  );
}
