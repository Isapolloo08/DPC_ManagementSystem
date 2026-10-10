import { useId } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function LessonNoticeField({ value, onChange, disabled }: Props) {
  const id = useId();
  return <div>
    <label htmlFor={id} className="ui-field mb-1">Lesson Notice & Specific Location (Saan Banda Sila)</label>
    <textarea id={id} rows={3} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
      aria-describedby={`${id}-help`} className="ui-input"
      placeholder="Hal. Chapter 2, verses 1–17; page 18, question #3. Tapos na ang introduction, discussion ang susunod." />
    <p id={`${id}-help`} className="ui-help mt-1">Ilagay ang verse, page, section, o question kung saan kayo huminto at kung ano ang susunod.</p>
  </div>;
}
