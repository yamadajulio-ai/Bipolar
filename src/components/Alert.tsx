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
    border: "border-info/20",
    bg: "bg-info/8",
    text: "text-info",
    iconColor: "text-info",
    defaultIcon: Info,
  },
  warning: {
    border: "border-warning/20",
    bg: "bg-warning/8",
    text: "text-foreground",
    iconColor: "text-warning",
    defaultIcon: AlertTriangle,
  },
  danger: {
    border: "border-danger/20",
    bg: "bg-danger/8",
    text: "text-danger",
    iconColor: "text-danger",
    defaultIcon: AlertCircle,
  },
  success: {
    border: "border-success/20",
    bg: "bg-success/8",
    text: "text-success",
    iconColor: "text-success",
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
