import type { HTMLAttributes } from 'react';
import './badge.css';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function Badge({ variant = 'neutral', count, className = '', ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant; count?: number }) {
  return <span {...props} className={`ui-badge ui-badge--${count === 0 ? 'neutral' : variant} ${className}`} />;
}
