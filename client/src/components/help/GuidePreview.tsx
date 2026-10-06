import { useMemo, useState } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import type { TaskGuide } from './guideContent';

/** The existing app in a separate document, backed only by its sample database. */
export function GuidePreview({ guide, role, index, onClose }: {
  guide: TaskGuide; role: string; index: number; onClose: () => void;
}) {
  const [session, setSession] = useState(0);
  const source = useMemo(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('guide-demo', '1');
    url.searchParams.set('guide', guide.id);
    url.searchParams.set('role', role);
    url.searchParams.set('step', String(index));
    url.searchParams.set('theme', document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    return url.href;
  }, [guide.id, role, index]);
  return <section className="help-demo-shell" aria-label="Interactive sample workspace">
    <div className="help-demo-toolbar">
      <p><ShieldCheck className="w-4 h-4 shrink-0" />Dummy account and sample data only. Saves affect this demo only.</p>
      <div className="flex gap-2 shrink-0">
        <button type="button" className="help-secondary" onClick={() => setSession(value => value + 1)}><RotateCcw className="w-4 h-4" />Restart demo</button>
        <button type="button" className="help-primary" onClick={onClose}>Return to real guide</button>
      </div>
    </div>
    <iframe key={session} title="Interactive guide demo" className="help-demo-frame" src={source} sandbox="allow-scripts allow-same-origin allow-forms" />
  </section>;
}
