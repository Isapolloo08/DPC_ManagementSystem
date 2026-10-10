import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DialogPanel } from './DialogPanel';
import { Button } from './Button';
import './modal-shell.css';

interface Props {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  /** Forms can prevent dismissal while they contain unsaved changes. */
  hasUnsavedChanges?: boolean;
  closeOnOutside?: boolean;
  showCloseFooter?: boolean;
  className?: string;
}

/** Shared presentation shell; its caller owns actions, dirty state and data. */
export function ModalShell({ title, subtitle, icon, size = 'md', children, footer, onClose,
  busy = false, hasUnsavedChanges = false, closeOnOutside = true, showCloseFooter = !footer, className = '' }: Props) {
  const headingId = useId();
  const dismiss = () => { if (!busy && !hasUnsavedChanges) onClose(); };
  return createPortal(<div className="shared-modal-backdrop" onClick={event => {
    if (event.target === event.currentTarget && closeOnOutside) dismiss();
  }}>
    <DialogPanel onClose={dismiss} busy={busy} aria-labelledby={headingId}
      className={`shared-modal-shell shared-modal-shell--${size} directory-design ${className}`}>
      <div data-modal-header className="shared-modal-heading">
        {icon && <span className="shared-modal-icon" aria-hidden="true">{icon}</span>}
        <div className="min-w-0 flex-1"><h2 id={headingId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <Button variant="ghost" size="icon" disabled={busy} onClick={dismiss}
          aria-label={`Close ${title}`} title={`Close ${title}`}><X size={18} aria-hidden="true" /></Button>
      </div>
      {children}
      {(footer || showCloseFooter) && <div data-modal-footer className="shared-modal-actions">
        {footer || <Button variant="secondary" onClick={dismiss}>Close</Button>}
      </div>}
    </DialogPanel>
  </div>, document.body);
}
