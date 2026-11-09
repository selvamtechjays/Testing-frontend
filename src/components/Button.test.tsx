// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to a primary, non-submitting button (ui-standards §5)', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('button', 'button--primary');
    expect(button).not.toHaveClass('button--block');
  });

  it.each(['secondary', 'danger', 'quiet'] as const)(
    'applies the %s variant inside the component',
    (variant) => {
      render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole('button')).toHaveClass(`button--${variant}`);
    },
  );

  it('stretches with block, keeps an extra class, forwards the ref and submits when asked', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button type="submit" block className="extra" ref={ref}>
        Send
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('button--block', 'extra');
    expect(ref.current).toBe(button);
  });

  it('calls onClick, and not when disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
