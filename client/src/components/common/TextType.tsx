import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { gsap } from 'gsap';

interface TextTypeProps extends HTMLAttributes<HTMLElement> {
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: ReactNode;
  cursorClassName?: string;
  cursorBlinkDuration?: number;
  textColors?: string[];
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
}

// TypeScript adaptation of the React Bits TextType reference supplied for this dashboard.
export default function TextType({
  text, as: Component = 'div', typingSpeed = 50, initialDelay = 0,
  pauseDuration = 2000, deletingSpeed = 30, loop = true, className = '',
  showCursor = true, hideCursorWhileTyping = false, cursorCharacter = '|',
  cursorClassName = '', cursorBlinkDuration = 0.5, textColors = [], variableSpeed,
  onSentenceComplete, startOnVisible = false, reverseMode = false, ...props
}: TextTypeProps) {
  const signature = JSON.stringify(text);
  const sentences = useMemo<string[]>(() => {
    const value = JSON.parse(signature);
    return typeof value === 'string' ? [value] : value.length ? value : [''];
  }, [signature]);
  const [progress, setProgress] = useState({ index: 0, chars: 0, cycle: 0, phase: 'waiting' });
  const [visible, setVisible] = useState(!startOnVisible);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const containerRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const callbackRef = useRef(onSentenceComplete);
  const completionRef = useRef('');
  const sentence = sentences[progress.index] ?? sentences[0];
  const characters = useMemo(() => {
    const chars = Array.from(sentence);
    return reverseMode ? chars.reverse() : chars;
  }, [sentence, reverseMode]);

  useEffect(() => { callbackRef.current = onSentenceComplete; }, [onSentenceComplete]);
  useEffect(() => {
    completionRef.current = '';
    setProgress({ index: 0, chars: 0, cycle: 0, phase: 'waiting' });
  }, [signature, reverseMode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refresh = () => setReducedMotion(media.matches);
    refresh();
    media.addEventListener('change', refresh);
    return () => media.removeEventListener('change', refresh);
  }, []);

  useEffect(() => {
    if (!startOnVisible) { setVisible(true); return; }
    setVisible(false);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!visible || reducedMotion || progress.phase === 'finished') return;
    let delay: number;
    let next: typeof progress;
    if (progress.phase === 'waiting') {
      delay = initialDelay;
      next = { ...progress, phase: 'typing' };
    } else if (progress.phase === 'typing') {
      delay = variableSpeed ? variableSpeed.min + Math.random() * (variableSpeed.max - variableSpeed.min) : typingSpeed;
      const chars = Math.min(progress.chars + 1, characters.length);
      next = { ...progress, chars, phase: chars === characters.length ? 'holding' : 'typing' };
    } else if (progress.phase === 'holding') {
      const completion = `${signature}:${progress.cycle}:${progress.index}`;
      if (completionRef.current !== completion) {
        completionRef.current = completion;
        callbackRef.current?.(sentence, progress.index);
      }
      if (!loop && progress.index === sentences.length - 1) {
        setProgress({ ...progress, phase: 'finished' });
        return;
      }
      delay = pauseDuration;
      next = { ...progress, phase: 'deleting' };
    } else {
      delay = deletingSpeed;
      const chars = Math.max(0, progress.chars - 1);
      next = chars > 0 ? { ...progress, chars } : {
        index: (progress.index + 1) % sentences.length, chars: 0,
        cycle: progress.cycle + 1, phase: 'typing',
      };
    }
    const timer = window.setTimeout(() => setProgress(next), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [progress, visible, reducedMotion, characters, sentence, sentences, signature, initialDelay,
    typingSpeed, pauseDuration, deletingSpeed, loop, variableSpeed?.min, variableSpeed?.max]);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor || !showCursor || reducedMotion || !visible) return;
    gsap.set(cursor, { opacity: 1 });
    const blink = gsap.to(cursor, { opacity: 0, duration: cursorBlinkDuration, repeat: -1, yoyo: true, ease: 'power2.inOut' });
    return () => { blink.kill(); };
  }, [showCursor, reducedMotion, visible, cursorBlinkDuration]);

  const displayedText = reducedMotion ? characters.join('') : characters.slice(0, progress.chars).join('');
  const hideCursor = reducedMotion || !visible || (hideCursorWhileTyping && ['waiting', 'typing', 'deleting'].includes(progress.phase));
  return createElement(Component, { ...props, ref: containerRef, className: `inline-block whitespace-pre-wrap ${className}` },
    <span className="text-type-content" style={{ color: textColors.length ? textColors[progress.index % textColors.length] : undefined }}>{displayedText}</span>,
    showCursor && <span ref={cursorRef} className={`text-type-cursor ml-1 inline-block ${cursorClassName}`} style={{ visibility: hideCursor ? 'hidden' : undefined }} aria-hidden="true">{cursorCharacter}</span>,
  );
}
