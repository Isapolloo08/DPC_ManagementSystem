import type { HTMLAttributes, ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  "data-guide"?: string;
  headingProps?: HTMLAttributes<HTMLHeadingElement> & { "data-guide"?: string };
}

/** Shared page hierarchy, with room for wrapping controls and dropdowns. */
export function PageHeader({ title, description, icon, meta, actions, children, className = "", headingProps, "data-guide": guide }: PageHeaderProps) {
  return <header data-page-header data-guide={guide} className={`page-header ${className}`}>
    <div className="page-header-row">
      <div className="page-header-main">
        <span className="page-header-icon" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <h1 {...headingProps} className="page-header-title">{title}</h1>
          {description && <p className="page-header-description">{description}</p>}
          {meta && <div className="page-header-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
    {children && <div className="page-header-content">{children}</div>}
  </header>;
}
