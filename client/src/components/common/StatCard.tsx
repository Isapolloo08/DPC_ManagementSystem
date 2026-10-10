import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";

type StatTone = "indigo" | "emerald" | "rose" | "amber" | "sky" | "cyan" | "sage" | "neutral";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon: ReactNode;
  description?: ReactNode;
  valueHint?: ReactNode;
  valueSize?: "number" | "text";
  tone?: StatTone;
  progress?: number;
  children?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

/** A shared metric hierarchy; interactive metrics retain native button behavior. */
export function StatCard({ label, value, icon, description, valueHint, valueSize = "number", tone = "indigo", progress, children, onClick, selected }: StatCardProps) {
  const content = <>
    <div className="stat-card-heading">
      <p className="stat-card-label">{label}</p>
      <span className="stat-card-icon" aria-hidden="true">{icon}</span>
    </div>
    <div className="stat-card-reading">
      <p className="stat-card-value" data-size={valueSize}>{valueSize === "number" && (typeof value === "number" || typeof value === "string") ? <AnimatedNumber value={value} /> : value}</p>
      {valueHint && <span className="stat-card-value-hint">{valueHint}</span>}
    </div>
    {progress !== undefined && <div className="stat-card-progress" role="progressbar" aria-label={typeof label === "string" ? label : "Progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))}>
      <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
    </div>}
    {description && <p className="stat-card-description">{description}</p>}
    {children && <div className="stat-card-detail">{children}</div>}
  </>;
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={selected} className="stat-card stat-card-action" data-tone={tone}>{content}</button>
    : <div className="stat-card" data-tone={tone}>{content}</div>;
}
