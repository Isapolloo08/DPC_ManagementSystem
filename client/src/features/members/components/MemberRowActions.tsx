import { useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Gift, MoreHorizontal, Pencil, Trash2, TrendingUp } from 'lucide-react';

interface Props {
  name: string;
  canEdit: boolean;
  onDetails: () => void;
  onEdit: () => void;
  onOverview: () => void;
  onMilestones: () => void;
  onGreeting: () => void;
  onDelete: () => void;
}

export function MemberRowActions(props: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    const box = trigger.current!.getBoundingClientRect();
    const height = menu.current?.offsetHeight || 224;
    setPosition({ left: Math.max(8, Math.min(box.right - 256, innerWidth - 264)),
      top: box.bottom + height + 8 < innerHeight ? box.bottom + 6 : Math.max(8, box.top - height - 6) });
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const resize = () => close();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize); };
  }, [open, props.canEdit]);
  const items = [
    { label: 'Attendance Intelligence, Rates & Streaks', icon: TrendingUp, action: props.onOverview },
    { label: 'Water Baptism Milestones & Attendance Tracker', icon: Calendar, action: props.onMilestones },
    { label: 'Send Birthday Blessing', icon: Gift, action: props.onGreeting },
    ...(props.canEdit ? [{ label: 'Delete Member Record', icon: Trash2, action: props.onDelete, destructive: true }] : []),
  ];
  return <div className="member-row-actions" onClick={event => event.stopPropagation()}>
    <button type="button" data-guide="member-details" className="member-row-action" onClick={props.onDetails} title={`Details for ${props.name}`}>Details</button>
    {props.canEdit && <button type="button" className="member-row-action" onClick={props.onEdit} aria-label={`Edit ${props.name}`} title="Edit Member Record"><Pencil size={14} aria-hidden="true" />Edit</button>}
    <button ref={trigger} id={`${id}-trigger`} type="button" className="member-row-action member-row-action--icon"
      aria-label={`More actions for ${props.name}`} title="More member actions" aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}>
      <MoreHorizontal size={18} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-labelledby={`${id}-trigger`}
      className="member-action-menu" style={{ top: position.top, left: position.left }} onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        const buttons = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        else if (event.key === 'Tab') close();
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      {items.map(item => <button key={item.label} role="menuitem" type="button"
        className={'destructive' in item ? 'member-menu-delete' : ''} title={item.label}
        onClick={() => { close(true); item.action(); }}><item.icon size={16} aria-hidden="true" /><span>{item.label}</span></button>)}
    </div>, document.body)}
  </div>;
}
