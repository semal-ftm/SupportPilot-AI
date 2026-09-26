import { useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { initials } from "../lib/format";

const buttonVariants = {
  primary:
    "bg-brand text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_6px_16px_-6px_var(--brand)] hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  soft: "bg-brand-soft text-brand-ink hover:brightness-95 dark:hover:brightness-125",
  danger: "bg-bad-soft text-bad hover:brightness-95 dark:hover:brightness-125",
};

const buttonSizes = {
  xs: "h-7 text-xs gap-1 rounded-md",
  sm: "h-8 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 text-sm gap-2 rounded-lg",
  lg: "h-11 text-[15px] gap-2 rounded-xl",
};

// Width/padding per size, kept separate so icon-only buttons stay square
const buttonPadding = { xs: "px-2", sm: "px-3", md: "px-3.5", lg: "px-5" };
const iconOnlyWidth = { xs: "w-7", sm: "w-8", md: "w-9", lg: "w-11" };

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all select-none",
        "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        children ? buttonPadding[size] : iconOnlyWidth[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" strokeWidth={2} />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx("rounded-2xl border border-line bg-surface shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={clsx("flex items-start justify-between gap-3 px-5 pt-5 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
            <Icon className="size-4" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  brand: "bg-brand-soft text-brand-ink border-transparent",
  good: "bg-good-soft text-good border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

export function Badge({ tone = "neutral", icon: Icon, dot, className, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {Icon && <Icon className="size-3" strokeWidth={2.25} />}
      {children}
    </span>
  );
}

const fieldBase =
  "rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 disabled:opacity-60";

export function Input({ icon: Icon, className, ...props }) {
  if (!Icon) return <input className={clsx(fieldBase, "h-9", className || "w-full")} {...props} />;

  return (
    <div className={clsx("relative", className)}>
      <Icon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input className={clsx(fieldBase, "h-9 w-full ps-9")} {...props} />
    </div>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={clsx(fieldBase, "min-h-20 w-full resize-y py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={clsx(fieldBase, "h-9 cursor-pointer pe-8", className || "w-full")} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, className }) {
  return <label className={clsx("mb-1.5 block text-xs font-medium text-ink-2", className)}>{children}</label>;
}

export function Skeleton({ className }) {
  return <div className={clsx("animate-pulse rounded-lg bg-surface-3", className)} />;
}

export function Spinner({ className }) {
  return <Loader2 className={clsx("size-4 animate-spin text-muted", className)} />;
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="relative mb-4">
          <div className="grid-bg absolute -inset-4 rounded-full opacity-60 [mask-image:radial-gradient(closest-side,black,transparent)]" />
          <div className="relative grid size-12 place-items-center rounded-2xl border border-line bg-surface text-muted shadow-card">
            <Icon className="size-5" />
          </div>
        </div>
      )}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, className, tone = "neutral" }) {
  return (
    <div
      className={clsx(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        tone === "brand" ? "brand-gradient text-white" : "bg-surface-3 text-ink-2",
        className || "size-8 text-xs"
      )}
      aria-hidden
    >
      {initials(name) || "?"}
    </div>
  );
}

export function Segmented({ value, onChange, options, className, size = "md" }) {
  return (
    <div className={clsx("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-all",
            size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]",
            value === option.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
          )}
        >
          {option.icon && <option.icon className="size-3.5" />}
          {option.label}
          {option.count !== undefined && (
            <span className="rounded bg-surface-3 px-1 text-[10px] tabular text-ink-2">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const handler = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, children, width = "max-w-2xl" }) {
  useEscape(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in" onClick={onClose} />
      <div
        className={clsx(
          "drawer-panel relative flex h-full w-full flex-col border-s border-line bg-surface shadow-pop",
          width
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }) {
  useEscape(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx("animate-in relative w-full rounded-2xl border border-line bg-surface shadow-pop", width)}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** One friendly sentence explaining what the page is for, plus optional actions. */
export function PageIntro({ children, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-[15px] text-muted">{children}</p>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
