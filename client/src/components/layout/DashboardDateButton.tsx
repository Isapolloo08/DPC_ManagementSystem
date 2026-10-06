import { CalendarDays } from 'lucide-react';
import { useLocalTime } from '../../hooks/useLocalTime';

export function DashboardDateButton({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const now = useLocalTime();
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return <button type="button" onClick={onOpenCalendar}
    aria-label={`Open church calendar for ${date}`} title={date}
    className="dashboard-date-button inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white p-2 xl:px-3 text-charcoal text-[12px] cursor-pointer hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-light">
    <CalendarDays size={15} aria-hidden="true" /><span className="hidden xl:inline whitespace-nowrap">{date}</span>
  </button>;
}
