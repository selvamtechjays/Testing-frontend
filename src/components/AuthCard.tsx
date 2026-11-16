import type { ReactNode } from 'react';
import './AuthCard.css';

interface AuthCardProps {
  heading: string;
  children: ReactNode;
  /** The line under the card that links to the other auth screen. */
  footer: ReactNode;
}

/** Sign-in and register share one centred card: heading, form, then the cross-link below. */
export function AuthCard({ heading, children, footer }: AuthCardProps) {
  return (
    <div className="auth">
      <div className="auth-backdrop" aria-hidden="true">
        <span className="auth-orb auth-orb--one" />
        <span className="auth-orb auth-orb--two" />
      </div>
      <div className="card auth-card">
        <h1 className="auth-heading">{heading}</h1>
        {children}
      </div>
      <p className="auth-footer">{footer}</p>
    </div>
  );
}
