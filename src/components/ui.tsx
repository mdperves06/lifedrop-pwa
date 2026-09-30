import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { bloodLabel } from "@/lib/blood";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-strong shadow-card",
  secondary: "bg-surface-2 text-fg hover:bg-border",
  outline: "border border-border bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-success text-white hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm gap-1.5",
  md: "min-h-11 px-4 text-[15px] gap-2",
  lg: "min-h-13 px-6 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors select-none",
    "disabled:opacity-55 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function BloodBadge({ group, size = "md" }: { group: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "size-16 text-2xl" : size === "sm" ? "size-9 text-sm" : "size-12 text-lg";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary", s)} aria-label={`Blood group ${bloodLabel(group)}`}>
      {bloodLabel(group)}
    </span>
  );
}

export const requestStatusTone: Record<string, Tone> = {
  DRAFT: "neutral",
  OPEN: "info",
  MATCHING: "info",
  DONOR_CONTACTED: "warning",
  DONOR_ACCEPTED: "success",
  FULFILLED: "success",
  CLOSED: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

export const priorityTone: Record<string, Tone> = { NORMAL: "neutral", URGENT: "warning", EMERGENCY: "danger" };
export const stockTone: Record<string, Tone> = { ADEQUATE: "success", LOW: "warning", CRITICAL: "danger" };

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <div className="mb-3 text-primary" aria-hidden="true">
        {icon ?? <DropIcon className="size-10" />}
      </div>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title ? "mt-0.5" : "", "text-fg/90")}>{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "neutral", icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <Card className="flex items-start gap-3">
      {icon && <div className={cx("rounded-xl p-2", tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

export function Label({ htmlFor, children, required, className }: { htmlFor?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx("mb-1.5 block text-sm font-medium", className)}>
      {children}
      {required && <span className="ml-0.5 text-primary" aria-hidden="true">*</span>}
    </label>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-xl border border-border bg-surface px-3.5 py-2 text-[15px] text-fg placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60 aria-[invalid=true]:border-danger";

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

export function Pagination({ page, pages, hrefFor, labels }: { page: number; pages: number; hrefFor: (p: number) => string; labels: { prev: string; next: string; page: string; of: string } }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between gap-2" aria-label="Pagination">
      {page > 1 ? <LinkButton variant="outline" size="sm" href={hrefFor(page - 1)}>{labels.prev}</LinkButton> : <span />}
      <span className="text-sm text-muted">
        {labels.page} {page} {labels.of} {pages}
      </span>
      {page < pages ? <LinkButton variant="outline" size="sm" href={hrefFor(page + 1)}>{labels.next}</LinkButton> : <span />}
    </nav>
  );
}

// ─────────────────────────── Icons (inline, no icon font) ───────────────────────────
type IconProps = { className?: string };
const I = ({ className, children }: IconProps & { children: ReactNode }) => (
  <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const DropIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M12 2.7C12 2.7 5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.7 12 2.7z" />
  </I>
);
export const HomeIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </I>
);
export const SearchIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </I>
);
export const PlusIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);
export const BellIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </I>
);
export const UserIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </I>
);
export const MapPinIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </I>
);
export const PhoneIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </I>
);
export const CalendarIcon = (p: IconProps) => (
  <I {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </I>
);
export const ClockIcon = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </I>
);
export const AlertIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </I>
);
export const CheckIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M20 6 9 17l-5-5" />
  </I>
);
export const XIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </I>
);
export const MenuIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </I>
);
export const HospitalIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M3 21h18M5 21V7l7-4 7 4v14" />
    <path d="M12 9v6M9 12h6" />
  </I>
);
export const ChartIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-6" />
  </I>
);
export const ShieldIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </I>
);
export const HeartIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
  </I>
);
export const StarIcon = ({ className, filled }: IconProps & { filled?: boolean }) => (
  <svg className={className ?? "size-4"} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
  </svg>
);
export const FlagIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 22V4a1 1 0 0 1 1-1h13l-2 5 2 5H5" />
  </I>
);
export const DownloadIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </I>
);
export const BookIcon = (p: IconProps) => (
  <I {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </I>
);
