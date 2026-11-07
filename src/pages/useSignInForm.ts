import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';

/** State and submit behaviour of the sign-in form. Error text is always page copy, never server text. */
export function useSignInForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const { signedIn } = useAuth();
  const navigate = useNavigate();

  // After a credential refusal the password is cleared and focus moves back to it.
  useEffect(() => {
    if (focusTick > 0) formRef.current?.querySelector<HTMLInputElement>('#password')?.focus();
  }, [focusTick]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (username === '' || password === '') return setError(copy.signInMissing);
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await signIn(username, password);
      signedIn(user);
      navigate('/', { replace: true });
    } catch (caught) {
      const refused =
        caught instanceof ApiError && (caught.status === 400 || caught.status === 401);
      setError(refused ? copy.invalidCredentials : copy.signInFailed);
      if (refused) {
        setPassword('');
        setFocusTick((tick) => tick + 1);
      }
      setSubmitting(false);
    }
  };

  return { username, setUsername, password, setPassword, submitting, error, formRef, submit };
}
