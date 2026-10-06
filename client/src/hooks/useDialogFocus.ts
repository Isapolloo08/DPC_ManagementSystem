import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';
const openDialogs: HTMLElement[] = [];

/** Focus and Escape belong to the top dialog, including when dialogs are nested. */
export function useDialogFocus(ref: RefObject<HTMLDivElement | null>, onClose: () => void, busy: boolean) {
  const actions = useRef({ onClose, busy });
  actions.current = { onClose, busy };
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(panel);
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(element => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
    (panel.querySelector<HTMLElement>("[data-dialog-autofocus]") || controls()[0] || panel).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!actions.current.busy) actions.current.onClose();
      } else if (event.key === "Tab") {
        const elements = controls();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); panel.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const wasTop = openDialogs[openDialogs.length - 1] === panel;
      const index = openDialogs.indexOf(panel);
      if (index >= 0) openDialogs.splice(index, 1);
      if (wasTop && trigger?.isConnected) trigger.focus();
    };
  }, [ref]);
}
