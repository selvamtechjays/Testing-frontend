import { Link } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { Button } from '../components/Button';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { copy } from '../copy';
import { useRegisterForm } from './useRegisterForm';

/** Public registration form: username and password only. All text is rendered as React text nodes. */
export function RegisterPage() {
  const form = useRegisterForm();
  return (
    <AuthCard
      heading={copy.registerHeading}
      footer={
        <>
          {copy.haveAccount} <Link to="/signin">{copy.signInLink}</Link>
        </>
      }
    >
      <form ref={form.formRef} onSubmit={form.submit} noValidate>
        <TextField
          id="username"
          label={copy.usernameLabel}
          value={form.username}
          onChange={form.setUsername}
          error={form.fieldErrors.username}
          hint={copy.usernameHint}
          autoComplete="username"
        />
        <TextField
          id="password"
          label={copy.passwordLabel}
          type="password"
          value={form.password}
          onChange={form.setPassword}
          error={form.fieldErrors.password}
          hint={copy.passwordHint}
          autoComplete="new-password"
        />
        {form.formError ? <StatusMessage kind="alert">{form.formError}</StatusMessage> : null}
        <Button type="submit" block disabled={form.submitting}>
          {form.submitting ? copy.creatingAccount : copy.createAccount}
        </Button>
      </form>
    </AuthCard>
  );
}
