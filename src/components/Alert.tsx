import { clsx } from "clsx";
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AlertProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
  icon?: LucideIcon | false;
  className?: string;
}

const variantConfig: Record<
  string,
  { border: string; bg: string; text: string; iconColor: string; defaultIcon: LucideIcon }
> = {
  info: {
    border: "border-info-border",
    bg: "bg-info-bg-subtle",
    text: "text-info-fg",
    iconColor: "text-info-fg",
    defaultIcon: Info,
  },
  warning: {
    border: "border-warning-border",
    bg: "bg-warning-bg-subtle",
    text: "text-foreground",
    iconColor: "text-warning-fg",
    defaultIcon: AlertTriangle,
  },
  danger: {
    border: "border-danger-border",
    bg: "bg-danger-bg-subtle",
    text: "text-danger-fg",
    iconColor: "text-danger-fg",
    defaultIcon: AlertCircle,
  },
  success: {
    border: "border-success-border",
    bg: "bg-success-bg-subtle",
    text: "text-success-fg",
    iconColor: "text-success-fg",
    defaultIcon: CheckCircle2,
  },
};

export function Alert({
  children,
  variant = "info",
  title,
  icon,
  className,
}: AlertProps) {
  const config = variantConfig[variant];
  const isUrgent = variant === "danger";
  const showIcon = icon !== false;
  const IconComponent = icon || config.defaultIcon;

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={clsx(
        "flex gap-3 rounded-[var(--radius-card)] border p-3 text-sm",
        config.border,
        config.bg,
        config.text,
        className,
      )}
    >
      {showIcon && (
        <div className="mt-0.5 shrink-0">
          <IconComponent size={18} strokeWidth={1.75} className={config.iconColor} aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <p className="mb-0.5 text-sm font-semibold text-foreground">{title}</p>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}
