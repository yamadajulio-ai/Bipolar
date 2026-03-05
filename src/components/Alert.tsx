import { clsx } from "clsx";

interface AlertProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "danger" | "success";
  className?: string;
}

const variantStyles = {
  info: "border-info/30 bg-info/10 text-info",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  danger: "border-danger/30 bg-danger/10 text-danger",
  success: "border-success/30 bg-success/10 text-success",
};

export function Alert({ children, variant = "info", className }: AlertProps) {
  const isUrgent = variant === "danger";
  return (
    <div
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={clsx(
        "rounded-lg border p-3 text-sm",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
