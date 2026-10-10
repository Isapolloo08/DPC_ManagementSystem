import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import './action-menu.css';

export interface MenuAction { label: string; onClick: () => void; icon?: ReactNode; destructive?: boolean; guide?: string }
export function ActionMenu({ label, items }: { label: string; items: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current!.getBoundingClientRect(), height = menu.current?.offsetHeight || 200;
      setPosition({ left: Math.max(8, Math.min(box.right - 240, innerWidth - 248)),
        top: box.bottom + height + 8 < innerHeight ? box.bottom + 6 : Math.max(8, box.top - height - 6) });
    };
    place();
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside); window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);
  return <>
    <Button ref={trigger} variant="secondary" size="icon" aria-label={label} title={label} aria-haspopup="menu"
      aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
      <MoreHorizontal size={18} aria-hidden="true" />
    </Button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={label} className="ui-action-menu"
      style={position} onKeyDown={event => {
        const buttons = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); }
        else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
          event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
      }}>{items.map(item => <button key={item.label} type="button" role="menuitem" data-guide={item.guide}
        className={item.destructive ? 'ui-action-menu-danger' : ''} onClick={() => { close(); item.onClick(); }}>
        {item.icon}<span>{item.label}</span>
      </button>)}</div>, document.body)}
  </>;
}
