import { FilterPanel } from "../common/FilterPanel";
import { Check, CheckCircle2, CheckSquare, Info, Search, SlidersHorizontal, UserCheck, UserX } from 'lucide-react';
import { Button } from '../common/Button';
import './batchRollCall.css';

type Method = 'absent_rest_present' | 'present_rest_absent' | 'present_only';
const methods = [
  { value: 'absent_rest_present', guide: 'absent', title: 'Mark Absentees (Exception)', description: 'Unselected members will be present.', icon: UserX },
  { value: 'present_rest_absent', guide: 'present', title: 'Mark Present Attendees', description: 'Unselected members will be absent.', icon: UserCheck },
  { value: 'present_only', guide: 'selected', title: 'Mark Selected Present Only', description: 'Unselected members stay unchanged.', icon: CheckSquare },
] as const;

interface Props {
  method: Method;
  onMethodChange: (method: Method) => void;
  selectedCount: number;
  scopeCount: number;
  matchingCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  households?: string[];
  household?: string;
  onHouseholdChange?: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onInvert: () => void;
  onSave: () => void;
  submitting: boolean;
}

export function BatchRollCallToolbar(props: Props) {
  const remaining = Math.max(0, props.scopeCount - props.selectedCount);
  const present = props.method === 'absent_rest_present' ? remaining : props.selectedCount;
  const absent = props.method === 'absent_rest_present' ? props.selectedCount : remaining;
  return <section className="batch-roll-call" aria-label="Batch roll call controls">
    <div className="batch-roll-call__heading">
      <SlidersHorizontal size={16} aria-hidden="true" />
      <h3>Choose your roll call method</h3>
      <span>{props.scopeCount} members in scope</span>
    </div>
    <div className="batch-roll-call__methods">
      {methods.map(({ value, guide, title, description, icon: Icon }) => <button
        key={value} type="button" data-guide={`attendance-method-${guide}`}
        aria-pressed={props.method === value} disabled={props.submitting}
        onClick={() => props.onMethodChange(value)} className="batch-roll-call__method">
        <span className="batch-roll-call__icon"><Icon size={18} aria-hidden="true" /></span>
        <span className="batch-roll-call__method-copy"><strong>{title}</strong><small>{description}</small></span>
        {props.method === value && <CheckCircle2 className="batch-roll-call__checked" size={18} aria-hidden="true" />}
      </button>)}
    </div>
    <div className="batch-roll-call__filters">
      <FilterPanel title="Roll call filters" className="batch-roll-call__filter-panel" summary={[props.search, props.household && props.household !== "all" ? props.household + " Family" : "All households"].filter(Boolean).join(" · ")}>
        <div className="batch-roll-call__filter-inputs">      <label className="batch-roll-call__search">
        <span>Find members</span>
        <div><Search size={16} aria-hidden="true" /><input data-guide="attendance-search" type="search"
          placeholder="Search member in roll call..." value={props.search} disabled={props.submitting}
          onChange={event => props.onSearchChange(event.target.value)} /></div>
      </label>
      {props.households && <label className="batch-roll-call__household"><span>Household</span>
        <select data-guide="attendance-batch-household" value={props.household} disabled={props.submitting}
          onChange={event => props.onHouseholdChange?.(event.target.value)}>
          <option value="all">All Households</option>
          {props.households.map(name => <option key={name} value={name}>{name} Family</option>)}
        </select>
      </label>}
</div>
      </FilterPanel>
      <div data-guide="attendance-selection-tools" className="batch-roll-call__selection">
        <Button size="sm" disabled={props.submitting || props.matchingCount === 0} onClick={props.onSelectAll}
          title="Select all matching members across all pages">Select All ({props.matchingCount})</Button>
        <Button size="sm" variant="ghost" disabled={props.submitting || props.selectedCount === 0} onClick={props.onClear}>Clear ({props.selectedCount})</Button>
        <Button size="sm" variant="ghost" disabled={props.submitting || props.matchingCount === 0} onClick={props.onInvert}>Invert</Button>
      </div>
    </div>
    <p className="batch-roll-call__hint"><Info size={15} aria-hidden="true" />
      <span>{props.method === 'present_only' ? 'Select members to mark present. Other attendance records stay unchanged.'
        : `Select ${props.method === 'absent_rest_present' ? 'absent' : 'present'} members. Saving applies to all ${props.scopeCount} members in scope, including other pages and search results.`}</span>
    </p>
    <div className="batch-roll-call__review">
      <div className="batch-roll-call__preview" role="status" aria-live="polite">
        <span className="batch-roll-call__preview-label">Preview before saving · {props.selectedCount} selected</span>
        <div><span className="batch-roll-call__present">{present} Present</span>
          {props.method === 'present_only' ? <span>{remaining} Unchanged</span> : <span className="batch-roll-call__absent">{absent} Absent</span>}
        </div>
      </div>
      <Button data-guide="attendance-batch-save" variant="primary" pending={props.submitting}
        disabled={props.scopeCount === 0 || (props.method === 'present_only' && props.selectedCount === 0)} onClick={props.onSave}>
        {!props.submitting && <Check size={16} aria-hidden="true" />}
        {props.submitting ? 'Saving attendance...' : 'Save Attendance Changes'}
      </Button>
    </div>
  </section>;
}
