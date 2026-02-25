import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-border bg-surface p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
