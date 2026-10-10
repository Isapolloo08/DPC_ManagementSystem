import type { Ministry } from '../../types';
import './event-ministry-picker.css';

export function EventMinistryPicker({ ministries, value, onChange, label = 'Target Ministry / Department' }: {
  ministries: Ministry[]; value: number[]; onChange: (ids: number[]) => void; label?: string;
}) {
  return <fieldset className="event-ministry-picker"><legend>{label}</legend>
    <label><input type="checkbox" checked={!value.length} onChange={() => onChange([])} />Church-wide / All Ministries</label>
    <div className="event-ministry-options">{ministries.map(ministry => <label key={ministry.id}><input type="checkbox" checked={value.includes(ministry.id)}
      onChange={e => onChange(e.target.checked ? [...value, ministry.id] : value.filter(id => id !== ministry.id))} />{ministry.name}</label>)}</div>
    <small>{value.length > 1 ? `${value.length} ministries collaborating` : 'Select one or more ministries for this event.'}</small>
  </fieldset>;
}
