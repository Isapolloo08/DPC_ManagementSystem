import { useId } from 'react';
import { Clock, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../context/ThemeContext';

export function ThemeSelector() {
  const { mode, resolvedTheme, setMode } = useTheme();
  const descriptionId = useId();
  const Icon = mode === 'auto' ? Clock : mode === 'dark' ? Moon : Sun;
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-charcoal shadow-sm shrink-0">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <select
        aria-label="Appearance"
        aria-describedby={descriptionId}
        title="Auto: light from 6 AM to 6 PM; dark overnight (device time)"
        value={mode}
        onChange={(event) => setMode(event.target.value as ThemeMode)}
        className="w-[62px] cursor-pointer rounded bg-transparent text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="auto">Auto</option>
      </select>
      <span id={descriptionId} className="sr-only">
        Auto uses light mode from 6 AM to 6 PM and dark mode overnight, based on this device's local time. Currently {resolvedTheme}.
      </span>
    </div>
  );
}
