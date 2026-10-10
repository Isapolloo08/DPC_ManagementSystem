import type { CSSProperties, RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { EventItem } from '../../types';
import type { NavTab } from '../layout/Sidebar';
import type { ChurchFocusGeometry } from './useChurchFocus';
import { ChurchBuilding } from './ChurchBuilding';
import { ChurchFocusPanel, type ChurchStat } from './ChurchFocusPanel';

interface ChurchFocusOverlayProps {
  focused: boolean;
  entered: boolean;
  geometry: ChurchFocusGeometry;
  overlayRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelId: string;
  timeOfDay: string;
  stats: ChurchStat[];
  groupTab?: NavTab | null;
  nextGathering?: EventItem;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenProfile?: () => void;
}

export function ChurchFocusOverlay({ focused, entered, geometry, overlayRef, triggerRef, panelId, timeOfDay, stats, groupTab, nextGathering, onClose, onNavigate, onOpenProfile }: ChurchFocusOverlayProps) {
  const { origin, target, panel } = geometry;
  const style = {
    '--focus-left': `${target.left}px`, '--focus-top': `${target.top}px`,
    '--focus-width': `${target.width}px`, '--focus-height': `${target.height}px`,
    '--focus-origin-x': `${origin.left - target.left}px`, '--focus-origin-y': `${origin.top - target.top}px`, '--focus-origin-scale': origin.width / target.width,
    '--focus-panel-left': `${panel.left}px`, '--focus-panel-top': `${panel.top}px`, '--focus-panel-width': `${panel.width}px`, '--focus-panel-max-height': `${panel.maxHeight}px`,
  } as CSSProperties;
  return createPortal(<div ref={overlayRef} className="church-dashboard church-focus-overlay" data-church-focused={focused} data-entered={entered} data-time-of-day={timeOfDay} style={style} aria-hidden={!focused} inert={!focused}>
    <div className="church-focus-backdrop" aria-hidden="true" />
    <div className="church-focus-visual"><ChurchBuilding focused={focused} panelId={panelId} buttonRef={triggerRef} onToggle={onClose} /></div>
    <ChurchFocusPanel id={panelId} focused={focused} stats={stats} groupTab={groupTab} nextGathering={nextGathering} onClose={onClose} onNavigate={onNavigate} onOpenProfile={onOpenProfile} />
  </div>, document.body);
}
