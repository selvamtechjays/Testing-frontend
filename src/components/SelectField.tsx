import type { ChangeEvent } from 'react';
import './SelectField.css';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

interface SelectFieldProps<V extends string> {
  id: string;
  label: string;
  value: V;
  options: ReadonlyArray<SelectOption<V>>;
  onChange: (value: V) => void;
  /** Names the control for assistive tech without drawing the label (a row's own priority choice). */
  labelHidden?: boolean;
  disabled?: boolean;
}

/** Labelled native select: the sibling of TextField, so every choice list looks and behaves alike. */
export function SelectField<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
  labelHidden = false,
  disabled,
}: SelectFieldProps<V>) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as V);
  return (
    <div className="field select-field">
      {labelHidden ? null : <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        className="select-field-control"
        value={value}
        onChange={handleChange}
        aria-label={labelHidden ? label : undefined}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
