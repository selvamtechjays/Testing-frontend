import { Button } from './Button';
import type { PanelButtonProps } from './useRowPanel';

/** A row's Notes or Tags button: named for its task, and pointing at its panel while that is open. */
export function PanelToggleButton({
  label,
  text,
  disabled,
  ref,
  open,
  panelId,
  onClick,
}: PanelButtonProps & { label: string; text: string; disabled: boolean }) {
  return (
    <Button
      variant="secondary"
      ref={ref}
      disabled={disabled}
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={onClick}
    >
      {text}
    </Button>
  );
}
