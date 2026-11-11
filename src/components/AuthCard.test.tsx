// tier: component
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthCard } from './AuthCard';

describe('AuthCard', () => {
  it('renders the heading, the body inside the card and the footer below it', () => {
    const { container } = render(
      <AuthCard heading="Sign in" footer={<span>Other screen</span>}>
        <p>Body</p>
      </AuthCard>,
    );
    const card = container.querySelector('.auth-card');
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(card).toContainElement(screen.getByText('Body'));
    expect(card).not.toContainElement(screen.getByText('Other screen'));
  });
});
