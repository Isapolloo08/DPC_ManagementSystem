import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

export function ChurchCelestial() {
  const { resolvedTheme } = useTheme();
  const moonRef = useRef<SVGSVGElement>(null);
  const sunRef = useRef<SVGSVGElement>(null);
  const previousTheme = useRef(resolvedTheme);
  const animations = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    if (previousTheme.current === resolvedTheme) return;
    const outgoing = previousTheme.current === 'dark' ? moonRef.current : sunRef.current;
    const incoming = resolvedTheme === 'dark' ? moonRef.current : sunRef.current;
    previousTheme.current = resolvedTheme;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    if (!outgoing || !incoming || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animations.current = [
      outgoing.animate([{ opacity: .85, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(44px)' }], { duration: 380, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'both' }),
      incoming.animate([{ opacity: 0, transform: 'translateY(44px)' }, { opacity: .85, transform: 'translateY(0)' }], { duration: 460, delay: 280, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }),
    ];
    for (const animation of animations.current) void animation.finished.then(() => animation.cancel()).catch(() => {});
  }, [resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const simplify = () => { if (media.matches) animations.current.forEach(animation => animation.cancel()); };
    media.addEventListener('change', simplify);
    return () => { media.removeEventListener('change', simplify); animations.current.forEach(animation => animation.cancel()); };
  }, []);

  return <span className="church-celestial">
    <svg ref={moonRef} className="church-moon" viewBox="0 0 32 32" fill="currentColor" focusable="false"><path d="M26 21A13 13 0 0 1 11 3A13 13 0 1 0 26 21Z" /></svg>
    <svg ref={sunRef} className="church-sun" viewBox="0 0 32 32" fill="none" focusable="false"><circle cx="16" cy="16" r="7" fill="currentColor" /><path d="M16 2v3m0 22v3M2 16h3m22 0h3M6.1 6.1l2.1 2.1m15.6 15.6 2.1 2.1M6.1 25.9l2.1-2.1M23.8 8.2l2.1-2.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  </span>;
}
