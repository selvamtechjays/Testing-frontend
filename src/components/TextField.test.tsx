// tier: component
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';

interface HarnessProps {
  error?: string;
  type?: 'text' | 'password';
}

function Harness({ error, type }: HarnessProps) {
  const [value, setValue] = useState('');
  return (
    <TextField id="name" label="Name" value={value} onChange={setValue} error={error} type={type} />
  );
}

describe('TextField', () => {
  it('binds a visible label so the control has an accessible name (AC-5 AC-7 BR-3 TS-7)', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('is reachable by Tab and accepts typed input (AC-5 AC-7 TS-5 TS-8)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveFocus();
    await user.keyboard('abc');
    expect(input).toHaveValue('abc');
  });

  it('links error text with aria-describedby and sets aria-invalid (AC-5 BR-3 TS-7)', () => {
    render(<Harness error="Name is required" />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Name is required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('has no error linkage and is valid when there is no error (BR-3)', () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a password field as masked input (BR-3)', () => {
    render(<Harness type="password" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'password');
  });
});

describe('TextField hint and autocomplete', () => {
  it('links hint text with aria-describedby and passes autoComplete through (AC-2 AC-7)', () => {
    render(
      <TextField
        id="u"
        label="U"
        value=""
        onChange={() => {}}
        hint="Some hint"
        autoComplete="username"
      />,
    );
    const input = screen.getByLabelText('U');
    expect(input).toHaveAttribute('autocomplete', 'username');
    expect(input).toHaveAttribute('aria-describedby', 'u-hint');
    expect(screen.getByText('Some hint')).toHaveAttribute('id', 'u-hint');
  });

  it('lists hint then error ids when both are present (AC-7)', () => {
    render(<TextField id="u" label="U" value="" onChange={() => {}} hint="h" error="bad" />);
    expect(screen.getByLabelText('U')).toHaveAttribute('aria-describedby', 'u-hint u-error');
  });
});
