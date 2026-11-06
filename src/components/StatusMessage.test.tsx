// tier: component
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusMessage } from './StatusMessage';

describe('StatusMessage', () => {
  it('uses a status region for confirmations (AC-5 BR-3 TS-5)', () => {
    render(<StatusMessage kind="status">Saved</StatusMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses an alert region for errors (AC-5 BR-3 TS-7)', () => {
    render(<StatusMessage kind="alert">Something went wrong</StatusMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
