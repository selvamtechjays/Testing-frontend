import { Component, type ErrorInfo, type ReactNode } from 'react';
import { copy } from '../copy';
import { Button } from './Button';
import './FailureNotice.css';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  failed: boolean;
}

/** Catches a failed page-chunk download (offline, stale deploy) and offers a reload instead of a blank page. */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="failure-notice message message-alert">
        <span className="failure-notice-text">{copy.loadFailed}</span>
        <Button variant="quiet" className="failure-notice-dismiss" onClick={this.reload}>
          {copy.reload}
        </Button>
      </div>
    );
  }

  private reload = () => {
    window.location.reload();
  };
}
