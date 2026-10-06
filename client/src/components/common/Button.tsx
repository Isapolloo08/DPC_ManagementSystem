import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "icon";
  pending?: boolean;
}

// Complete class names let Tailwind retain each variant in production builds.
const variants = { primary: "ui-button--primary", secondary: "ui-button--secondary", ghost: "ui-button--ghost" };
const sizes = { sm: "ui-button--sm", md: "ui-button--md", icon: "ui-button--icon" };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", pending = false, disabled, className = "", children, type = "button", ...props }, ref
) {
  return <button {...props} ref={ref} type={type} disabled={disabled || pending}
    aria-busy={pending || undefined} className={`ui-button ${variants[variant]} ${sizes[size]} ${className}`}>
    {pending && <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin shrink-0" />}
    {children}
  </button>;
});
