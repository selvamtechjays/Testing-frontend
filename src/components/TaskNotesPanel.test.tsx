// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { TaskNotesPanel } from './TaskNotesPanel';

function setup(task: Task = buildTask({ id: 't1', title: 'Buy paint', notes: 'Call Ravi' })) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const onDirtyChange = vi.fn();
  const ui = (current: Task) => (
    <TaskNotesPanel
      task={current}
      onSave={onSave}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
    />
  );
  const view = render(ui(task));
  return { onSave, onClose, onDirtyChange, rerender: (next: Task) => view.rerender(ui(next)) };
}

const box = () => screen.getByRole('textbox', { name: 'Notes for Buy paint' });
const noNotes = () => buildTask({ id: 't2', title: 'Buy paint', notes: null });

describe('TaskNotesPanel editing (AC-7 AC-9)', () => {
  it('opens with the saved notes in a labelled box that has focus (AC-7)', () => {
    setup();
    expect(box()).toHaveValue('Call Ravi');
    expect(box()).toHaveFocus();
  });

  it('opens empty for a task with no notes, and offers no Clear notes (AC-2)', () => {
    setup(noNotes());
    expect(box()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear notes' })).not.toBeInTheDocument();
  });

  it('shows the characters left, tied to the box, and updates as the user types (AC-9)', async () => {
    setup(noNotes());
    expect(screen.getByText('1000 characters left')).toBeInTheDocument();
    await userEvent.type(box(), 'abc');
    const count = screen.getByText('997 characters left');
    expect(box()).toHaveAttribute('aria-describedby', count.id);
  });

  it('blocks input at 1000 characters and says 0 characters left (AC-9)', async () => {
    setup(noNotes());
    expect(box()).toHaveAttribute('maxlength', '1000');
    await userEvent.click(box());
    await userEvent.paste('a'.repeat(1200));
    expect((box() as HTMLTextAreaElement).value).toHaveLength(1000);
    expect(screen.getAllByText('0 characters left').length).toBeGreaterThan(0);
  });

  it('counts an emoji as two characters, so 500 of them fill the box (AC-9 DEC-240)', async () => {
    setup(noNotes());
    await userEvent.click(box());
    await userEvent.paste('😀'.repeat(501));
    expect((box() as HTMLTextAreaElement).value).toHaveLength(1000);
    expect(screen.getAllByText('0 characters left').length).toBeGreaterThan(0);
  });

  it('announces politely only when the count reaches 0 (AC-9)', async () => {
    setup(noNotes());
    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
    await userEvent.type(box(), 'abc');
    expect(live).toHaveTextContent('');
    await userEvent.paste('a'.repeat(1000));
    expect(live).toHaveTextContent('0 characters left');
  });

  it('keeps newlines in the box', async () => {
    setup(noNotes());
    await userEvent.type(box(), 'one{Enter}two');
    expect(box()).toHaveValue('one\ntwo');
  });
});

describe('TaskNotesPanel Save (AC-7)', () => {
  it('saves the trimmed text (AC-1 AC-7)', async () => {
    const { onSave } = setup();
    await userEvent.clear(box());
    await userEvent.type(box(), '  Call Ravi 98400 12345 ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Call Ravi 98400 12345');
  });

  it('saves whitespace-only text as no notes, null (AC-3 AC-2)', async () => {
    const { onSave } = setup();
    await userEvent.clear(box());
    await userEvent.type(box(), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('closes without a request when nothing changed, even if only spaces were added (DEC-242)', async () => {
    const { onSave, onClose } = setup();
    await userEvent.type(box(), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

describe('TaskNotesPanel closing without saving (AC-8)', () => {
  it('Cancel on a clean box closes as clean (AC-8)', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('Cancel after typing closes as dirty, so the not-saved line shows (AC-8)', async () => {
    const { onClose } = setup();
    await userEvent.type(box(), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('Escape closes like Cancel, and tells the list it was dirty (AC-8 AC-10)', async () => {
    const { onClose, onSave } = setup();
    await userEvent.type(box(), '!');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Escape on an untouched box closes as clean (AC-8)', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('reports whether the box is dirty as the user types and reverts (AC-8)', async () => {
    const { onDirtyChange } = setup();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await userEvent.type(box(), 'x');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard('{Backspace}');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('does not let Escape reach the document, where the failure notice listens (DEC-242)', async () => {
    setup();
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', seen);
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('TaskNotesPanel Clear notes confirmation (AC-2 AC-10)', () => {
  it('swaps the buttons for "Clear these notes?" and moves focus to it (AC-10)', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    const prompt = screen.getByRole('group', { name: 'Clear these notes?' });
    expect(prompt).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep notes' })).toBeInTheDocument();
  });

  it('clears with null once confirmed (AC-2)', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('Keep notes goes back to editing with focus on Clear notes, sending nothing (AC-2)', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep notes' }));
    expect(box()).toHaveValue('Call Ravi');
    expect(screen.getByRole('button', { name: 'Clear notes' })).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Escape in the confirmation backs out of it only, and does not close the panel (DEC-242)', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    await userEvent.keyboard('{Escape}');
    expect(box()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear notes' })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('can be driven with the keyboard alone: Tab to Clear notes, Enter, Tab to confirm (AC-10)', async () => {
    const { onSave } = setup();
    await userEvent.tab(); // Save
    await userEvent.tab(); // Cancel
    await userEvent.tab(); // Clear notes
    expect(screen.getByRole('button', { name: 'Clear notes' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Clear notes' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledWith(null);
  });
});

describe('TaskNotesPanel and a changed saved value (R-3)', () => {
  it('follows a changed saved value while the box is untouched', () => {
    const { rerender } = setup();
    rerender(buildTask({ id: 't1', title: 'Buy paint', notes: 'Call Ravi on Monday' }));
    expect(box()).toHaveValue('Call Ravi on Monday');
  });

  it('keeps what the user typed when the saved value changes underneath (R-3)', async () => {
    const { rerender } = setup();
    await userEvent.type(box(), ' and Sam');
    rerender(buildTask({ id: 't1', title: 'Buy paint', notes: 'Call Ravi on Monday' }));
    expect(box()).toHaveValue('Call Ravi and Sam');
  });
});
