// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tag, Task, TaskTag } from '../api/types';
import { buildTask } from '../test/builders/task';
import { buildTag } from '../test/mocks/tags';
import type { TagsStatus } from '../tasks/tasksContext';
import { TaskTagsPanel } from './TaskTagsPanel';

const asTaskTag = ({ id, name, colour }: Tag): TaskTag => ({ id, name, colour });

interface Options {
  tags?: Tag[];
  task?: Task;
  status?: TagsStatus;
  create?: (name: string) => Promise<{ ok: boolean; message?: string }>;
}

function setup({ tags = [], task, status = 'ready', create }: Options = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onCreate: vi.fn(create ?? (() => Promise.resolve({ ok: true }))),
    onRetryTags: vi.fn(),
    onClose: vi.fn(),
  };
  const row = task ?? buildTask({ id: 't1', title: 'Buy paint' });
  render(<TaskTagsPanel task={row} tags={tags} tagsStatus={status} {...handlers} />);
  return handlers;
}

const home = buildTag({ id: 'h', name: 'Home', colour: 'green' });
const work = buildTag({ id: 'w', name: 'Work', colour: 'blue' });

describe('TaskTagsPanel (FEAT-TAG-03 AC-6 AC-8 AC-17 to AC-20 AC-27)', () => {
  it('shows a checkbox per tag, ticked for the task tags (TAG03 AC-6)', () => {
    setup({ tags: [home, work], task: buildTask({ tags: [asTaskTag(work)] }) });
    expect(screen.getByRole('checkbox', { name: 'Home' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Work' })).toBeChecked();
  });

  it('asks to toggle the tag that was pressed (TAG03 AC-6)', async () => {
    const { onToggle } = setup({ tags: [home, work] });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Home' }));
    expect(onToggle).toHaveBeenCalledWith('h');
  });

  it('focuses the first enabled checkbox when it opens (TAG03 AC-27)', () => {
    setup({ tags: [home, work] });
    expect(screen.getByRole('checkbox', { name: 'Home' })).toHaveFocus();
  });

  it('focuses the Create tag box when there are no tags (TAG03 AC-27)', () => {
    setup({ tags: [] });
    expect(screen.getByRole('textbox', { name: 'Create tag' })).toHaveFocus();
  });

  it('disables the unticked tags and says so at five tags (TAG03 AC-19 BR-11)', () => {
    const five = Array.from({ length: 6 }, (_, i) => buildTag({ id: `x${i}`, name: `T${i}` }));
    setup({ tags: five, task: buildTask({ tags: five.slice(0, 5).map(asTaskTag) }) });
    expect(screen.getByText('A task can have up to 5 tags.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'T5' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'T0' })).toBeEnabled();
  });

  it('does not show the five-tag note below five tags (TAG03 AC-19)', () => {
    setup({ tags: [home, work], task: buildTask({ tags: [asTaskTag(home)] }) });
    expect(screen.queryByText('A task can have up to 5 tags.')).not.toBeInTheDocument();
  });

  it('sends what was typed as typed on Enter and clears the box when it worked (TAG03 AC-7 AC-8)', async () => {
    const { onCreate } = setup({ tags: [home] });
    const box = screen.getByRole('textbox', { name: 'Create tag' });
    await userEvent.type(box, '  Groceries {Enter}');
    expect(onCreate).toHaveBeenCalledWith('  Groceries ');
    expect(box).toHaveValue('');
  });

  it('sends an empty box too, so the server words the refusal, and shows its message (TAG03 AC-17)', async () => {
    const { onCreate } = setup({
      create: () => Promise.resolve({ ok: false, message: 'Enter a tag name.' }),
    });
    await userEvent.type(screen.getByRole('textbox', { name: 'Create tag' }), '{Enter}');
    expect(onCreate).toHaveBeenCalledWith('');
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a tag name.');
  });

  it('keeps what was typed when the create is refused, and shows the 31-character message (TAG03 AC-18)', async () => {
    setup({
      create: () =>
        Promise.resolve({ ok: false, message: 'Tag names can be at most 30 characters.' }),
    });
    const box = screen.getByRole('textbox', { name: 'Create tag' });
    await userEvent.type(box, `${'a'.repeat(31)}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('at most 30 characters');
    expect(box).toHaveValue('a'.repeat(31));
  });

  it('turns the Create tag box off and says so at fifty tags (TAG03 AC-20 BR-11)', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => buildTag({ id: `f${i}`, name: `Tag ${i}` }));
    setup({ tags: fifty });
    expect(screen.getByRole('textbox', { name: 'Create tag' })).toBeDisabled();
    expect(screen.getByText('You can have up to 50 tags.')).toBeInTheDocument();
  });

  it('closes on Escape from inside the panel (TAG03 AC-27)', async () => {
    const { onClose } = setup({ tags: [home] });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says it is loading while the tags load (TAG03 AC-6)', async () => {
    const loading = setup({ status: 'loading' });
    expect(screen.getByText('Loading tags')).toBeInTheDocument();
    expect(loading.onRetryTags).not.toHaveBeenCalled();
  });

  it('retries a failed tag load from the panel (TAG03 AC-6)', async () => {
    const { onRetryTags } = setup({ status: 'failed' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your tags.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryTags).toHaveBeenCalledTimes(1);
  });
});
