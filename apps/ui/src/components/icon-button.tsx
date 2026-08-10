import { useMemoizedFn } from "ahooks";
import { memo, type PropsWithChildren, type ReactElement } from "react";
import { cn } from "@/utils";

interface Props extends PropsWithChildren {
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactElement;
}

export const IconButton = memo(function IconButton({
  children,
  disabled,
  title,
  onClick,
  icon,
}: Props) {
  const handleClick = useMemoizedFn(() => {
    if (disabled) {
      return;
    }
    onClick?.();
  });

  return (
    <div
      className={cn(
        "flex size-6 shrink-0 cursor-pointer flex-row items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
        {
          "cursor-not-allowed": disabled,
          "opacity-50": disabled,
        },
      )}
      title={title}
      onClick={handleClick}
    >
      {icon}
      {children}
    </div>
  );
});
