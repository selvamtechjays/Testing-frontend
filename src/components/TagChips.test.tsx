// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TaskTag } from '../api/types';
import { TagChips } from './TagChips';

const tag = (id: string, name: string, colour: TaskTag['colour'] = 'gray'): TaskTag => ({
  id,
  name,
  colour,
});

describe('TagChips (FEAT-TAG-03 AC-5 AC-30 BR-12)', () => {
  it('renders nothing for a task with no tags (TAG03 AC-5)', () => {
    const { container } = render(<TagChips tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each tag name as text in the order given (TAG03 AC-5)', () => {
    render(<TagChips tags={[tag('1', 'Errands', 'red'), tag('2', 'Home', 'green')]} />);
    expect(screen.getByText('Errands')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Errands').compareDocumentPosition(screen.getByText('Home'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('colours by token class and always keeps the name as the text (TAG03 BR-12)', () => {
    render(<TagChips tags={[tag('1', 'Work', 'blue')]} />);
    expect(screen.getByText('Work')).toHaveClass('tag-chip', 'tag-chip--blue');
  });

  it('keeps a long name whole in the DOM and as the tooltip, for CSS to cut (TAG03 AC-30)', () => {
    const long = 'A'.repeat(30);
    render(<TagChips tags={[tag('1', long)]} />);
    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });

  it('shows a name made of markup as literal text, never as markup (TAG03 AC-30 R-4)', () => {
    const name = '<img src=x onerror=alert(1)>';
    const { container } = render(<TagChips tags={[tag('1', name)]} />);
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows names exactly as typed, accents and emoji included (TAG03 AC-7)', () => {
    render(<TagChips tags={[tag('1', 'Café'), tag('2', '🏠 Home')]} />);
    expect(screen.getByText('Café')).toBeInTheDocument();
    expect(screen.getByText('🏠 Home')).toBeInTheDocument();
  });
});

describe('TagChips as filters (FEAT-TAG-04 AC-7 AC-19 AC-21 AC-22 BR-9 BR-10)', () => {
  const tags = [tag('t1', 'Errands', 'red'), tag('t2', 'Home', 'green')];

  it('renders each chip as a real button named by the full tag name when selectable (TAG04 AC-22)', () => {
    render(<TagChips tags={tags} selectable onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Errands' })).toHaveAttribute('title', 'Errands');
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });

  it('keeps the chips as plain text when not selectable (TAG04 AC-22)', () => {
    render(<TagChips tags={tags} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('keeps the chips as plain text when nothing handles a selection (TAG04 AC-22)', () => {
    render(<TagChips tags={tags} selectable />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reports the id of the chip that was clicked (TAG04 AC-7)', async () => {
    const onSelect = vi.fn();
    render(<TagChips tags={tags} selectable onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onSelect).toHaveBeenCalledWith('t2');
  });

  it('can be reached with Tab and chosen with Enter or Space (TAG04 AC-22 AC-23)', async () => {
    const onSelect = vi.fn();
    render(<TagChips tags={tags} selectable onSelect={onSelect} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Errands' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onSelect.mock.calls).toEqual([['t1'], ['t2']]);
  });

  it('is not a toggle: choosing the same chip twice reports it twice, leaving the filter to the owner (TAG04 AC-19)', async () => {
    const onSelect = vi.fn();
    render(<TagChips tags={tags} selectable onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onSelect.mock.calls).toEqual([['t2'], ['t2']]);
  });

  it('keeps a 30-character name whole as the button name and tooltip (TAG04 AC-21)', () => {
    const long = 'Z'.repeat(30);
    render(<TagChips tags={[tag('t3', long)]} selectable onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: long })).toHaveAttribute('title', long);
  });
});
