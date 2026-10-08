import React, { forwardRef } from "react";
import { createPortal } from "react-dom";

/** Keep full-window backdrops outside page spacing, clipping, and stacking contexts. */
export const ViewportOverlay = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function ViewportOverlay({ children, className = "", ...props }, ref) {
    return createPortal(
      <div {...props} ref={ref} data-viewport-overlay className={`fixed inset-0 ${className}`}>
        {children}
      </div>,
      document.body,
    );
  },
);
