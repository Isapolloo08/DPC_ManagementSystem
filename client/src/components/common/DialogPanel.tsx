import { useRef, type HTMLAttributes } from 'react';
import { ModalPanel } from './ModalPanel';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export function DialogPanel({ onClose, busy = false, ...props }: HTMLAttributes<HTMLDivElement> & { onClose: () => void; busy?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onClose, busy);
  return <ModalPanel {...props} ref={panel} tabIndex={-1} role="dialog" aria-modal="true" />;
}
