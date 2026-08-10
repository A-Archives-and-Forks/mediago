import type React from "react";
import { cn } from "@/utils";

interface DownloadTagProps {
  icon?: React.ReactNode;
  text: string;
  color: string;
  className?: string;
}

export function DownloadTag({
  icon,
  text,
  color,
  className,
}: DownloadTagProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 cursor-default flex-row items-center gap-0.5 rounded-2xl rounded-bl-lg py-0.5 pl-1.5 pr-1.5 text-white [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-2",
        className,
      )}
      style={{ background: color }}
    >
      {icon}
      <span className="text-xs">{text}</span>
    </div>
  );
}
