import type { RefObject } from 'react';
import { ChurchAmbience, ChurchLighting } from './ChurchAmbience';

interface ChurchBuildingProps {
  focused: boolean;
  panelId: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onToggle: (trigger: HTMLButtonElement) => void;
}

export function ChurchBuilding({ focused, panelId, buttonRef, onToggle }: ChurchBuildingProps) {
  return <div className="church-building-scene">
    <div className="church-building-position">
      <span className="church-building-shadow" aria-hidden="true" />
      <div className="church-building-reveal">
        <button ref={buttonRef} type="button" className="church-building-button"
          onClick={event => onToggle(event.currentTarget)} aria-label={focused ? 'Return to dashboard overview' : 'Open church overview'} aria-expanded={focused} aria-controls={panelId}>
          <ChurchAmbience />
          <span className="church-building-art">
            <img src="/dpc_church_model.png" className="church-building-image"
              alt="Daet Presbyterian Church building" width={1448} height={1086} decoding="async" draggable={false} />
            <ChurchLighting />
          </span>
        </button>
      </div>
    </div>
  </div>;
}
