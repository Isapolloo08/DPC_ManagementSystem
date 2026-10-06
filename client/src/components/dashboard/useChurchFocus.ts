import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Bounds { left: number; top: number; width: number; height: number }
export interface ChurchFocusGeometry {
  origin: Bounds;
  target: Bounds;
  panel: { left: number; top: number; width: number; maxHeight: number };
  viewport: Bounds;
}

function measureFocus(hero: HTMLElement, panelHeight = 320): ChurchFocusGeometry {
  // Focus belongs to the whole window, including the softened sidebar/top bar.
  const viewport = { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const imageBounds = hero.querySelector<HTMLImageElement>('.church-building-image')?.getBoundingClientRect();
  const ratio = 1448 / 1086;
  // Match the actual object-fit content rather than the larger image element box.
  const width = imageBounds ? Math.min(imageBounds.width, imageBounds.height * ratio) : 0;
  const height = width / ratio;
  const opener = hero.querySelector('.overview-profile-link')?.getBoundingClientRect() || hero.getBoundingClientRect();
  const origin = width > 0 && imageBounds
    ? { left: imageBounds.left + (imageBounds.width - width) / 2, top: imageBounds.bottom - height, width, height }
    : { left: opener.left, top: opener.top, width: 100, height: 75 };
  const sideBySide = viewport.width >= 1060;
  const panelWidth = Math.min(sideBySide ? 280 : 360, viewport.width - 32);
  const availablePanelHeight = Math.min(panelHeight, Math.max(160, viewport.height - 160));
  const churchWidth = sideBySide ? Math.min(440, viewport.width * .34, (viewport.height - 48) * ratio) : Math.min(320, viewport.width - 64, Math.max(96, (viewport.height - availablePanelHeight - 64) * ratio));
  const churchHeight = churchWidth / ratio;
  const centerX = viewport.left + viewport.width / 2;
  // Place the focused model in the upper center, above the dashboard cards.
  const centerY = viewport.top + Math.max(churchHeight / 2 + 24, Math.min(viewport.height * .25, 280));
  const stackedHeight = churchHeight + 24 + availablePanelHeight;
  const churchTop = sideBySide ? centerY - churchHeight / 2 : viewport.top + Math.min(32, Math.max(16, (viewport.height - stackedHeight) / 2));
  const target = { left: centerX - churchWidth / 2, top: churchTop, width: churchWidth, height: churchHeight };
  const panelTop = sideBySide ? Math.max(viewport.top + 16, centerY - availablePanelHeight / 2) : churchTop + churchHeight + 24;
  return { origin, target, viewport, panel: {
    left: sideBySide ? target.left + churchWidth + 24 : centerX - panelWidth / 2,
    top: panelTop, width: panelWidth, maxHeight: Math.max(100, viewport.top + viewport.height - panelTop - 16),
  } };
}

export function useChurchFocus() {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [geometry, setGeometry] = useState<ChurchFocusGeometry | null>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef(false);

  const open = useCallback((trigger: HTMLButtonElement) => {
    if (!heroRef.current) return;
    openerRef.current = trigger;
    restoreRef.current = false;
    setGeometry(measureFocus(heroRef.current));
    setEntered(false);
    setVisible(true);
    setFocused(true);
  }, []);
  const close = useCallback((restoreFocus = true) => {
    if (heroRef.current) {
      const next = measureFocus(heroRef.current);
      setGeometry(previous => previous ? { ...previous, origin: next.origin } : next);
    }
    restoreRef.current = restoreFocus;
    setFocused(false);
    setEntered(false);
  }, []);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const main = hero.closest('main') || hero;
    let previousLeft = -1;
    const align = () => {
      const left = main.getBoundingClientRect().left;
      if (left === previousLeft) return;
      previousLeft = left;
      // Sidebar width changes every frame. Updating this decorative layer directly
      // keeps it aligned without rendering the dashboard and all its stars again.
      skyRef.current?.style.setProperty('--sky-workspace-left', `${left}px`);
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(main);
    window.addEventListener('resize', align);
    return () => { observer.disconnect(); window.removeEventListener('resize', align); };
  }, []);

  useLayoutEffect(() => {
    if (!visible) {
      if (triggerRef.current) triggerRef.current.inert = false;
      if (restoreRef.current) { openerRef.current?.focus({ preventScroll: true }); restoreRef.current = false; }
      return;
    }
    if (triggerRef.current) triggerRef.current.inert = true;
    if (!focused) return;
    focusTriggerRef.current?.focus({ preventScroll: true });
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => setEntered(true)); });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [visible, focused]);

  useEffect(() => {
    if (focused || !visible) return;
    // Match the visual's CSS transition before restoring the source and sky.
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 360;
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timeout);
  }, [focused, visible]);

  useLayoutEffect(() => {
    if (!focused) return;
    const update = () => {
      if (!heroRef.current) return;
      const panelHeight = overlayRef.current?.querySelector<HTMLElement>('.church-focus-panel')?.offsetHeight || 320;
      const next = measureFocus(heroRef.current, panelHeight);
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const observer = new ResizeObserver(update);
    const panel = overlayRef.current?.querySelector('.church-focus-panel');
    if (panel) observer.observe(panel);
    window.addEventListener('resize', update);
    update();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    const onOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      // Keep the top bar usable, including theme changes while viewing the model.
      if (event.target instanceof Element && event.target.closest('header')) return;
      if (overlayRef.current?.querySelector('.church-focus-visual')?.contains(event.target) || overlayRef.current?.querySelector('.church-focus-panel')?.contains(event.target)) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside, true);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', update);
      document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onOutside, true);
    };
  }, [focused, close]);

  return { focused, visible, entered, geometry, skyRef, heroRef, triggerRef, focusTriggerRef, mobileTriggerRef, overlayRef, open, close };
}
