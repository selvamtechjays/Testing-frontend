import type { ChangeEvent } from 'react';

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'password';
}

/** Labelled input; links its error text via aria-describedby and sets aria-invalid. */
export function TextField({ id, label, value, onChange, error, type = 'text' }: TextFieldProps) {
  const errorId = `${id}-error`;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
