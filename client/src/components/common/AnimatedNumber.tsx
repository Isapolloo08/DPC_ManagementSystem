import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/** Count metrics without changing their final formatting or accessible value. */
export function AnimatedNumber({ value }: { value: number | string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = String(value);
  const match = text.match(/^(-?[\d,]+(?:\.\d+)?)(%)?$/);
  const target = match ? Number(match[1].replace(/,/g, "")) : NaN;
  const decimals = match?.[1].split(".")[1]?.length ?? 0;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !Number.isFinite(target)) return;
    const motion = gsap.matchMedia();
    motion.add({ reduce: "(prefers-reduced-motion: reduce)", animate: "(prefers-reduced-motion: no-preference)" }, context => {
      element.textContent = text;
      if (context.conditions?.reduce || target === 0) return;
      const counter = { value: 0 };
      let tween: ReturnType<typeof gsap.to> | undefined;
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        element.textContent = "0" + (match?.[2] ?? "");
        tween = gsap.to(counter, {
          value: target, duration: 0.85, ease: "power2.out",
          onUpdate: () => {
            const current = Number(counter.value.toFixed(decimals));
            element.textContent = (text.includes(",")
              ? current.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
              : current.toFixed(decimals)) + (match?.[2] ?? "");
          },
          onComplete: () => { element.textContent = text; },
        });
      }, { threshold: 0.1 });
      observer.observe(element);
      return () => { observer.disconnect(); tween?.kill(); element.textContent = text; };
    });
    return () => motion.revert();
  }, [text, target, decimals]);

  if (!match || !Number.isFinite(target)) return <>{value}</>;
  return <span className="animated-number">
    <span className="sr-only">{text}</span>
    <span className="animated-number-reserve" aria-hidden="true">{text}</span>
    <span className="animated-number-current" aria-hidden="true" ref={ref}>{text}</span>
  </span>;
}
