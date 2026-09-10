import { createElement, useEffect, useId, useRef } from "react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  size = "md",
  className,
  busy = false,
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "ui-button",
        `ui-button--${variant}`,
        size !== "md" && `ui-button--${size}`,
        className
      )}
      aria-busy={busy || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = "info", className, children, ...props }) {
  return (
    <span className={cn("ui-badge", `ui-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export function Card({ as = "section", className, children, padded = false, ...props }) {
  return createElement(
    as,
    {
      className: cn("ui-card", padded && "ui-card-pad", className),
      ...props,
    },
    children
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleId,
}) {
  return (
    <header className={cn("ui-page-header", className)}>
      <div className="ui-page-header-copy">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1 className="ui-page-title" id={titleId}>
          {title}
        </h1>
        {description && <p className="ui-page-description">{description}</p>}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </header>
  );
}

export function Field({ label, htmlFor, hint, error, errorId, className, children }) {
  return (
    <div className={cn("ui-field", className)}>
      {label && (
        <label className="ui-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="ui-help">{hint}</p>}
      {error && (
        <p className="ui-field-error" id={errorId} role="alert">
          {error.message || error}
        </p>
      )}
    </div>
  );
}

export function Alert({ tone = "info", className, role, children }) {
  const resolvedRole = role || (tone === "danger" ? "alert" : "status");
  return (
    <div
      className={cn("ui-alert", `ui-alert--${tone}`, className)}
      role={resolvedRole}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, description, actions, className, children }) {
  return (
    <div className={cn("ui-empty-state", className)}>
      <div className="ui-empty-state-mark" aria-hidden="true">·</div>
      {title && <p className="ui-empty-state-title">{title}</p>}
      {description && <p className="ui-empty-state-description">{description}</p>}
      {children}
      {actions && <div className="ui-empty-state-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, detail, tone = "primary", className }) {
  return (
    <article className={cn("ui-stat-card", `ui-stat-card--${tone}`, className)}>
      <p className="ui-stat-card-label">{label}</p>
      <p className="ui-stat-card-value">{value}</p>
      {detail && <p className="ui-stat-card-detail">{detail}</p>}
    </article>
  );
}

export function SectionHeader({ title, description, aside, className }) {
  return (
    <div className={cn("ui-section-header", className)}>
      <div>
        <h2 className="ui-section-title">{title}</h2>
        {description && <p className="ui-section-description">{description}</p>}
      </div>
      {aside && <div className="ui-section-aside">{aside}</div>}
    </div>
  );
}

export function TableFrame({ children, className, label }) {
  return (
    <div
      className={cn("ui-table-wrap", className)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className, ...props }) {
  return <div className={cn("ui-skeleton", className)} aria-hidden="true" {...props} />;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleCancel = (event) => {
    event.preventDefault();
    onCancel?.();
  };

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      onCancel={handleCancel}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="ui-dialog-content">
        <div className="ui-dialog-mark" aria-hidden="true">!</div>
        <div>
          <h2 className="ui-dialog-title" id={titleId}>{title}</h2>
          {description && (
            <p className="ui-dialog-description" id={descriptionId}>
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="ui-dialog-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} disabled={busy} busy={busy}>
          {busy ? "Procesando…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
