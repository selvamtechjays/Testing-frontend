import { Link, Navigate, useLocation } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { useSignInForm } from './useSignInForm';

/** Public sign-in form. No Remember me, no Forgot password, no lockout text (BR-2, BR-3). */
export function SignInPage() {
  const form = useSignInForm();
  const { status } = useAuth();
  const location = useLocation();
  const signedOutNotice = (location.state as { signedOut?: boolean } | null)?.signedOut === true;

  // DEC-066: a signed-in user opening /signin goes straight to the task list.
  if (status === 'signedIn') return <Navigate to="/" replace />;

  return (
    <>
      <h1>{copy.signInHeading}</h1>
      {signedOutNotice ? <StatusMessage kind="status">{copy.signedOutNotice}</StatusMessage> : null}
      <form ref={form.formRef} onSubmit={form.submit} noValidate>
        <TextField
          id="username"
          label={copy.usernameLabel}
          value={form.username}
          onChange={form.setUsername}
          autoComplete="username"
        />
        <TextField
          id="password"
          label={copy.passwordLabel}
          type="password"
          value={form.password}
          onChange={form.setPassword}
          autoComplete="current-password"
        />
        {form.error ? <StatusMessage kind="alert">{form.error}</StatusMessage> : null}
        <button type="submit" disabled={form.submitting}>
          {form.submitting ? copy.signingIn : copy.signInHeading}
        </button>
      </form>
      <p>
        {copy.noAccount} <Link to="/register">{copy.registerLink}</Link>
      </p>
    </>
  );
}
