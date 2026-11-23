import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { exitDurationMs } from '../lib/motion';
import { useExitingItems } from './useExitingItems';

/** What a row's panel button needs: it points at the panel while that is open. */
export interface PanelButtonProps {
  ref: Ref<HTMLButtonElement>;
  open: boolean;
  panelId: string;
  onClick: () => void;
}

/**
 * One row panel (notes or tags) under its button. The panel animates out when it closes. Leaving
 * it by its own controls or the button hands focus back to the button (`handBack` before closing);
 * being closed because another row opened does not.
 */
export function useRowPanel(open: boolean, panelId: string, onToggle: (() => void) | undefined) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const wasOpen = useRef(false);
  const [exitMs] = useState(exitDurationMs);
  const items = useMemo(() => (open ? [{ id: panelId }] : []), [open, panelId]);
  const shown = useExitingItems(items, exitMs);

  useEffect(() => {
    if (wasOpen.current && !open && refocus.current) buttonRef.current?.focus();
    if (!open) refocus.current = false;
    wasOpen.current = open;
  }, [open]);

  const handBack = () => {
    refocus.current = true;
  };
  const button: PanelButtonProps = {
    ref: buttonRef,
    open,
    panelId,
    onClick: () => {
      if (open) handBack();
      onToggle?.();
    },
  };
  return { shown, handBack, button };
}
