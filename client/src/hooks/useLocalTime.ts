import { useEffect, useState } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

// Refresh at minute boundaries, and catch up when the app wakes or regains focus.
export function useLocalTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      window.clearTimeout(timer);
      setNow(new Date());
      timer = window.setTimeout(refresh, 60_000 - Date.now() % 60_000);
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return now;
}
