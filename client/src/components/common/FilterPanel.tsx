import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Filter, RotateCcw } from "lucide-react";
import "./filter-panel.css";

interface FilterPanelProps {
  children: ReactNode;
  title?: string;
  summary?: string;
  actions?: ReactNode;
  onReset?: () => void;
  defaultExpanded?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Collapse only the controls: their values and page-owned filtering stay active. */
export function FilterPanel({ children, title = "Search & Filter Options", summary = "Selections stay active when filters are collapsed.", actions, onReset, defaultExpanded = true, className = "", "aria-label": label }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();
  return (
    <section className={`filter-panel ${className}`} aria-label={label || title} data-expanded={expanded}>
      <div className="filter-panel-heading">
        <button type="button" className="filter-panel-toggle" aria-label={expanded ? "Collapse filters" : "Expand filters"} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
          <Filter size={16} aria-hidden="true" />
          <span><strong>{title}</strong><span className="filter-panel-summary">{summary}</span></span>
          {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
        </button>
        {(actions || onReset) && <div className="filter-panel-actions">{actions}{onReset && <button type="button" className="filter-panel-reset" onClick={onReset}><RotateCcw size={14} aria-hidden="true" />Reset Filters</button>}</div>}
      </div>
      <div id={contentId} hidden={!expanded} className="filter-panel-fields">{children}</div>
    </section>
  );
}
