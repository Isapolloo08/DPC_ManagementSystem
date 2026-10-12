import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

const clampZoom = (value: number) => Math.round(Math.min(2.5, Math.max(0.4, value)) * 100) / 100;

export function useFamilyTreeNavigation(canvas: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const current = useRef(view);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const update = (next: typeof view) => { current.current = next; setView(next); };

  const zoomAt = (value: number, clientX?: number, clientY?: number) => {
    const element = canvas.current;
    const stage = element?.querySelector<HTMLElement>('.family-tree-stage');
    const old = current.current;
    const zoom = clampZoom(value);
    if (!element || !stage || zoom === old.zoom) return;
    const bounds = element.getBoundingClientRect(), rect = stage.getBoundingClientRect();
    const px = clientX ?? bounds.left + element.clientWidth / 2;
    const py = clientY ?? bounds.top + element.clientHeight / 2;
    const localX = (px - rect.left) / old.zoom, localY = (py - rect.top) / old.zoom;
    // The scaled wrapper is centered when it fits the viewport; compensate for that shift.
    const width = stage.offsetWidth;
    const oldMargin = Math.max(0, (element.clientWidth - width * old.zoom) / 2);
    const newMargin = Math.max(0, (element.clientWidth - width * zoom) / 2);
    update({ zoom, x: old.x + localX * (old.zoom - zoom) + oldMargin - newMargin, y: old.y + localY * (old.zoom - zoom) });
  };
  const zoomHandler = useRef(zoomAt);
  zoomHandler.current = zoomAt;
  useEffect(() => {
    const element = canvas.current;
    if (!enabled || !element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      zoomHandler.current(current.current.zoom * Math.exp(-Math.max(-120, Math.min(120, delta)) * 0.002), event.clientX, event.clientY);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { element.removeEventListener('wheel', wheel); drag.current = null; };
  }, [canvas, enabled]);

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    zoom: view.zoom, pan: { x: view.x, y: view.y }, dragging,
    zoomBy: (delta: number) => zoomAt(current.current.zoom + delta),
    reset: () => { update({ zoom: 1, x: 0, y: 0 }); canvas.current?.scrollTo({ left: 0, top: 0 }); },
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.pointerType === 'touch' || (event.target as HTMLElement).closest('.family-profile-link, .family-add-child')) return;
        suppressClick.current = false;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: current.current.x, panY: current.current.y, moved: false };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        start.moved = true;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        update({ zoom: current.current.zoom, x: start.panX + dx, y: start.panY + dy });
      },
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      },
      onDragStart: (event: React.DragEvent<HTMLDivElement>) => event.preventDefault(),
    },
  };
}
