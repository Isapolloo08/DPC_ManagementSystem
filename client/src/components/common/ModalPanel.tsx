import React, { Children, cloneElement, forwardRef, isValidElement, useId } from "react";

type ElementProps = { children?: React.ReactNode; className?: string; "data-modal-header"?: boolean; "data-modal-footer"?: boolean };
const marked = (child: React.ReactNode, marker: "data-modal-header" | "data-modal-footer") =>
  isValidElement<ElementProps>(child) && !!child.props[marker];

// Actions can live outside the scroll area and still submit/reset their original form.
function associateForm(children: React.ReactNode, formId: string): React.ReactNode {
  return Children.map(children, child => {
    if (!isValidElement<React.HTMLAttributes<HTMLElement> & { type?: string; form?: string }>(child)) return child;
    const action = (child.type === "button" && (!child.props.type || /^(submit|reset)$/.test(child.props.type))) ||
      (child.type === "input" && /^(submit|reset|image)$/.test(child.props.type || ""));
    return cloneElement(child, action ? { form: formId } : {},
      child.props.children ? associateForm(child.props.children, formId) : child.props.children);
  });
}

/** A bounded dialog surface. The header and actions stay outside the scrolling body. */
export const ModalPanel = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function ModalPanel({ children, className = "", style, ...props }, ref) {
    const generatedFormId = useId();
    const tokens = className.split(/\s+/);
    const isPadding = (token: string) => /^(?:(?:sm|md|lg|xl|2xl):)?p[trblxy]?-[\w.[\]-]+$/.test(token);
    const isSpacing = (token: string) => /^(?:(?:sm|md|lg|xl|2xl):)?space-y-/.test(token);
    const padding = tokens.filter(isPadding).join(" ");
    const spacing = tokens.filter(isSpacing).join(" ");
    const gap = tokens.find(token => /^space-y-[\d.]+$/.test(token))?.slice(8);
    const maxHeight = tokens.find(token => /^max-h-\[[\d.]+(?:d?vh|px|rem)\]$/.test(token))?.slice(7, -1);
    const surface = tokens.filter(token => !isPadding(token) && !isSpacing(token) && !/^(?:overflow-[xy]-|overflow-)/.test(token)).join(" ");
    const content = Children.toArray(children);
    const headerIndex = content.findIndex(child => marked(child, "data-modal-header"));
    const header = headerIndex >= 0 ? content.splice(headerIndex, 1)[0] : content.shift();
    const footerIndex = content.findIndex(child => marked(child, "data-modal-footer"));
    const footer = footerIndex >= 0 ? content.splice(footerIndex, 1)[0] : null;
    const bodyClass = `${padding} ${spacing} modal-layout-body custom-scrollbar`;
    const footerClass = `${padding} modal-layout-footer`;
    let body: React.ReactNode;

    const forms = content.filter(child => isValidElement(child) && child.type === "form");
    const form = forms.length === 1 ? forms[0] : null;
    if (isValidElement<ElementProps & { id?: string }>(form)) {
      const fields = Children.toArray(form.props.children);
      const formFooterIndex = fields.findIndex(child => marked(child, "data-modal-footer"));
      const actions = formFooterIndex >= 0 ? fields.splice(formFooterIndex, 1)[0] : null;
      const formId = form.props.id || generatedFormId;
      body = <div className="modal-layout-form">
        <div data-modal-body className={bodyClass}>
          {content.map(child => child === form ? cloneElement(form, { id: formId }, fields) : child)}
        </div>
        {actions && <div className={footerClass}>{associateForm(actions, formId)}</div>}
      </div>;
    } else {
      body = <div data-modal-body className={bodyClass}>{content}</div>;
    }

    return (
      <div {...props} ref={ref} data-modal-panel className={`${surface} flex flex-col modal-layout-panel`}
        style={{ ...style, "--modal-gap": padding && gap ? `${Number(gap) / 4}rem` : "0px", "--modal-max-height": maxHeight || "92vh" } as React.CSSProperties}>
        <div className={`${padding} modal-layout-header`}>{header}</div>
        {body}
        {footer && <div className={footerClass}>{footer}</div>}
      </div>
    );
  }
);
