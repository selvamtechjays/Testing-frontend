import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { passwordHint, usernameHint } from '../validation/credentials';

export interface FieldErrors {
  username?: string;
  password?: string;
}

/** State and submit behaviour of the registration form. */
export function useRegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Move focus to the first field with an error after each refused submit.
  useEffect(() => {
    if (focusTick > 0) {
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
    }
  }, [focusTick]);

  const refuse = (errors: FieldErrors) => {
    setFieldErrors(errors);
    setFormError(null);
    setSubmitting(false);
    setFocusTick((tick) => tick + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const local = { username: usernameHint(username), password: passwordHint(password) };
    if (local.username || local.password) return refuse(local);
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const { user } = await registerUser(username, password);
      setUser(user);
      navigate('/', { replace: true });
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields : {};
      if (fields.username || fields.password) return refuse(fields);
      setSubmitting(false);
      setFormError(copy.registerFailed);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    fieldErrors,
    formError,
    formRef,
    submit,
  };
}
