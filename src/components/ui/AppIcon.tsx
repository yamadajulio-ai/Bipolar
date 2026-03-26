import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type IconSize = "sm" | "md" | "lg";

const sizeMap: Record<IconSize, { size: number; strokeWidth: number }> = {
  sm: { size: 16, strokeWidth: 1.75 },
  md: { size: 20, strokeWidth: 1.75 },
  lg: { size: 24, strokeWidth: 1.5 },
};

interface AppIconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  "aria-hidden"?: boolean;
}

export function AppIcon({
  icon: Icon,
  size = "md",
  className,
  "aria-hidden": ariaHidden = true,
}: AppIconProps) {
  const { size: px, strokeWidth } = sizeMap[size];
  return (
    <Icon
      size={px}
      strokeWidth={strokeWidth}
      className={clsx("shrink-0", className)}
      aria-hidden={ariaHidden}
    />
  );
}
