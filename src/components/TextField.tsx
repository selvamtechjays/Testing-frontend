import type { ChangeEvent, KeyboardEvent, Ref } from 'react';

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: 'text' | 'password' | 'date';
  autoComplete?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** The latest value a date box accepts (type 'date'). */
  max?: string;
  /** Names the input for assistive tech without drawing the label (a row's own date box). */
  labelHidden?: boolean;
  disabled?: boolean;
  /** Stops typing at this many characters (a name box); the server still judges the value. */
  maxLength?: number;
  /** Extra class for the field wrapper, so a screen can place it. */
  className?: string;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** The hint and error lines under the input; the error is announced. */
function FieldMessages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Labelled input; links its hint and error text via aria-describedby and sets aria-invalid. */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  autoComplete,
  inputRef,
  max,
  labelHidden = false,
  disabled,
  className,
  maxLength,
  onBlur,
  onKeyDown,
}: TextFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  return (
    <div className={className ? `field ${className}` : 'field'}>
      {labelHidden ? null : <label htmlFor={id}>{label}</label>}
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        autoComplete={autoComplete}
        max={max}
        maxLength={maxLength}
        disabled={disabled}
        aria-label={labelHidden ? label : undefined}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}
