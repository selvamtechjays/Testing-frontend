import type { ButtonHTMLAttributes, Ref } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretch to the container's width (auth forms on every screen size). */
  block?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The one button. Variants live here, never as a class applied from the call site
 * (ui-standards.md §5). Defaults to type="button" so a stray button never submits a form.
 */
export function Button({
  variant = 'primary',
  block = false,
  type = 'button',
  className,
  ref,
  ...rest
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, block ? 'button--block' : null, className]
    .filter(Boolean)
    .join(' ');
  return <button ref={ref} type={type} className={classes} {...rest} />;
}
