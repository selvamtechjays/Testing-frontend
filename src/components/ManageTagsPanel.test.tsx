// tier: component
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tag } from '../api/types';
import { buildTag } from '../test/mocks/tags';
import { ManageTagsPanel } from './ManageTagsPanel';

const home = buildTag({ id: 'h', name: 'Home', colour: 'green', taskCount: 3 });
const work = buildTag({ id: 'w', name: 'Work', colour: 'blue', taskCount: 1 });

interface Options {
  tags?: Tag[];
  update?: (id: string, changes: object) => Promise<{ ok: boolean; message?: string }>;
  count?: number | null;
}

function setup({ tags = [home, work], update, count = 4 }: Options = {}) {
  const handlers = {
    onUpdate: vi.fn(update ?? (() => Promise.resolve({ ok: true as const }))),
    onDelete: vi.fn(() => Promise.resolve({ ok: true })),
    onFreshCount: vi.fn(() => Promise.resolve(count)),
    onRefresh: vi.fn(),
    onClose: vi.fn(),
  };
  render(<ManageTagsPanel tags={tags} {...handlers} />);
  return handlers;
}

const row = (name: string) => screen.getByRole('group', { name: `Tag ${name}` });

describe('ManageTagsPanel (FEAT-TAG-02 AC-1 AC-4 AC-5 AC-7 AC-9 to AC-11 AC-17 AC-20)', () => {
  it('lists every tag with its name and task count, and reads the tags once on open (TAG02 AC-1)', () => {
    const { onRefresh } = setup();
    expect(screen.getByRole('textbox', { name: 'Name of tag Home' })).toHaveValue('Home');
    expect(within(row('Home')).getByText('3 tasks')).toBeInTheDocument();
    expect(within(row('Work')).getByText('1 task')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Colour of tag Work' })).toHaveValue('blue');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the panel heading when it opens (TAG02 AC-20)', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Manage tags' })).toHaveFocus();
  });

  it('with no tags says so and has no Create control (TAG02 AC-7)', () => {
    setup({ tags: [] });
    expect(
      screen.getByText("No tags yet. Create one from a task's Tags picker."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Create tag$/)).not.toBeInTheDocument();
  });

  it('sends the trimmed name on Save and on Enter (TAG02 AC-2)', async () => {
    const { onUpdate } = setup();
    const box = screen.getByRole('textbox', { name: 'Name of tag Home' });
    await userEvent.clear(box);
    await userEvent.type(box, '  Office ');
    await userEvent.click(screen.getByRole('button', { name: 'Save name of tag Home' }));
    expect(onUpdate).toHaveBeenCalledWith('h', { name: 'Office' });
    const other = screen.getByRole('textbox', { name: 'Name of tag Work' });
    await userEvent.clear(other);
    await userEvent.type(other, ' Desk {Enter}');
    expect(onUpdate).toHaveBeenLastCalledWith('w', { name: 'Desk' });
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when the name has not changed (TAG02 AC-16)', async () => {
    const { onUpdate } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save name of tag Home' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('allows a name that differs only in letter case to be sent (TAG02 AC-16)', async () => {
    const { onUpdate } = setup();
    const box = screen.getByRole('textbox', { name: 'Name of tag Work' });
    await userEvent.clear(box);
    await userEvent.type(box, 'work{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('w', { name: 'work' });
  });

  it('shows the server message beside the field and keeps what was typed when refused (TAG02 AC-9 AC-10)', async () => {
    setup({
      update: () =>
        Promise.resolve({ ok: false, message: 'You already have a tag with that name.' }),
    });
    const box = screen.getByRole('textbox', { name: 'Name of tag Home' });
    await userEvent.clear(box);
    await userEvent.type(box, 'work{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have a tag with that name.',
    );
    expect(box).toHaveValue('work');
  });

  it('does not cap typing: a 31-character name goes to the server and its refusal shows (TAG02 AC-10 BR-1)', async () => {
    const tooLong = 'a'.repeat(31);
    const { onUpdate } = setup({
      update: () =>
        Promise.resolve({ ok: false, message: 'A tag name can be at most 30 characters.' }),
    });
    const box = screen.getByRole('textbox', { name: 'Name of tag Home' });
    expect(box).not.toHaveAttribute('maxLength');
    await userEvent.clear(box);
    await userEvent.type(box, `${tooLong}{Enter}`);
    expect(onUpdate).toHaveBeenCalledWith('h', { name: tooLong });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A tag name can be at most 30 characters.',
    );
    expect(box).toHaveValue(tooLong);
  });

  it('sends a 1-character and a 30-character name as typed (TAG02 TS-24)', async () => {
    const { onUpdate } = setup();
    const longest = 'b'.repeat(30);
    const first = screen.getByRole('textbox', { name: 'Name of tag Home' });
    await userEvent.clear(first);
    await userEvent.type(first, 'x{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('h', { name: 'x' });
    const second = screen.getByRole('textbox', { name: 'Name of tag Work' });
    await userEvent.clear(second);
    await userEvent.type(second, `${longest}{Enter}`);
    expect(onUpdate).toHaveBeenCalledWith('w', { name: longest });
  });

  it('sends accented and emoji names exactly as typed (TAG02 TS-23)', async () => {
    const { onUpdate } = setup();
    const first = screen.getByRole('textbox', { name: 'Name of tag Home' });
    await userEvent.clear(first);
    await userEvent.type(first, 'Café{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('h', { name: 'Café' });
    const second = screen.getByRole('textbox', { name: 'Name of tag Work' });
    await userEvent.clear(second);
    await userEvent.type(second, '🏠 Home{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('w', { name: '🏠 Home' });
  });

  it('sends only the colour when the colour select changes (TAG02 AC-3)', async () => {
    const { onUpdate } = setup();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Colour of tag Home' }),
      'purple',
    );
    expect(onUpdate).toHaveBeenCalledWith('h', { colour: 'purple' });
  });

  it('keeps the colour select on the saved colour until the tag changes (TAG02 AC-3 BR-4)', async () => {
    setup();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Colour of tag Home' }),
      'purple',
    );
    expect(screen.getByRole('combobox', { name: 'Colour of tag Home' })).toHaveValue('green');
  });

  it('reads a fresh count, then asks the question naming the tag and that count (TAG02 AC-4 AC-17)', async () => {
    const { onFreshCount, onDelete } = setup({ count: 4 });
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    expect(onFreshCount).toHaveBeenCalledWith('w');
    expect(
      await screen.findByText(
        'Delete tag "Work"? It will be removed from 4 tasks. The tasks are kept.',
      ),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('asks about one task in the singular (TAG02 AC-4)', async () => {
    setup({ count: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    expect(
      await screen.findByText(
        'Delete tag "Work"? It will be removed from 1 task. The tasks are kept.',
      ),
    ).toBeInTheDocument();
  });

  it('Keep sends nothing, closes the question and returns focus to that Delete button (TAG02 AC-5)', async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Keep' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/It will be removed/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete tag Work' })).toHaveFocus();
  });

  it('sends the delete only when Delete is chosen in the question (TAG02 AC-4)', async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Home' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('h');
  });

  it('shows no question when the count could not be read, and moves focus to the heading (TAG02 AC-18 AC-19)', async () => {
    const { onFreshCount } = setup({ count: null });
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Home' }));
    expect(onFreshCount).toHaveBeenCalled();
    expect(screen.queryByText(/It will be removed/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Manage tags' })).toHaveFocus();
  });

  it('Escape closes the question first, then the panel (TAG02 AC-20)', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Home' }));
    await screen.findByRole('button', { name: 'Keep' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from its Close button (TAG02 AC-20)', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns a row controls off while its request is out (TAG02 AC-19)', async () => {
    let finish: (() => void) | undefined;
    setup({
      update: () =>
        new Promise((resolve) => {
          finish = () => resolve({ ok: true });
        }),
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Colour of tag Home' }),
      'red',
    );
    expect(screen.getByRole('combobox', { name: 'Colour of tag Home' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Colour of tag Work' })).toBeEnabled();
    finish?.();
  });

  it('keeps a slow tag off while another tag finishes first (TAG02 AC-19)', async () => {
    const pending = new Map<string, () => void>();
    setup({
      update: (id) =>
        new Promise((resolve) => {
          pending.set(id, () => resolve({ ok: true }));
        }),
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Colour of tag Home' }),
      'red',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Colour of tag Work' }),
      'red',
    );
    await act(async () => pending.get('w')?.());
    expect(screen.getByRole('combobox', { name: 'Colour of tag Work' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Colour of tag Home' })).toBeDisabled();
    await act(async () => pending.get('h')?.());
    expect(screen.getByRole('combobox', { name: 'Colour of tag Home' })).toBeEnabled();
  });

  it('gives focus back to the name box once a rename by Enter has been answered (TAG02 BR-13)', async () => {
    let finish: (() => void) | undefined;
    setup({
      update: () =>
        new Promise((resolve) => {
          finish = () => resolve({ ok: false, message: 'You already have a tag with that name.' });
        }),
    });
    const box = screen.getByRole('textbox', { name: 'Name of tag Home' });
    await userEvent.clear(box);
    await userEvent.type(box, 'work{Enter}');
    expect(box).toBeDisabled();
    // A browser drops focus to the page when the focused control is disabled; jsdom keeps it and
    // will not blur a disabled control, so do what the browser does: blur it, still disabled.
    act(() => {
      box.removeAttribute('disabled');
      box.blur();
      box.setAttribute('disabled', '');
    });
    expect(document.body).toHaveFocus();
    await act(async () => finish?.());
    await waitFor(() => expect(box).toHaveFocus());
  });

  it('shows a tag name made of markup as literal text (TAG02 AC-2 TS-23)', () => {
    const name = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <ManageTagsPanel
        tags={[buildTag({ id: 'm', name })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onFreshCount={vi.fn()}
        onRefresh={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('textbox', { name: `Name of tag ${name}` })[0]).toHaveValue(name);
    expect(container.querySelector('img')).toBeNull();
  });
});
