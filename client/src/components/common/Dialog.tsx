import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ModalPanel } from "./ModalPanel";
import { Button } from "./Button";
import { useDialogFocus } from "../../hooks/useDialogFocus";

interface Props {
  title: string;
  accessibleName?: string;
  description?: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ title, accessibleName, description, closeLabel = "Close dialog", onClose, busy = false, children, footer }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, onClose, busy);
  return createPortal(<div className="ui-dialog-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <ModalPanel ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}
      aria-label={accessibleName} aria-labelledby={accessibleName ? undefined : titleId}
      aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined}
      className="ui-dialog p-5 space-y-4 w-full max-w-lg">
      <div data-modal-header className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 id={titleId} className="ui-dialog-title">{title}</h2>
          {description && <p id={descriptionId} className="ui-help mt-1">{description}</p>}</div>
        <Button variant="ghost" size="icon" disabled={busy} aria-label={closeLabel} onClick={onClose}>
          <X aria-hidden="true" className="w-4 h-4" />
        </Button>
      </div>
      {children}
      {footer && <div data-modal-footer className="ui-dialog-actions">{footer}</div>}
    </ModalPanel>
  </div>, document.body);
}
