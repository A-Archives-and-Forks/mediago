import type React from "react";
import type { FC } from "react";
import { cn } from "@/utils";

interface PageContainerProps {
  children: React.ReactNode | null;
  titleExtra?: React.ReactNode | null;
  rightExtra?: React.ReactNode | null;
  title?: React.ReactNode | null;
  className?: string;
  wrapperClassName?: string;
}

const PageContainer: FC<PageContainerProps> = ({
  children,
  titleExtra,
  rightExtra,
  title,
  className,
  wrapperClassName,
}) => {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden p-3",
        wrapperClassName,
      )}
    >
      {title ? (
        <header className="flex min-h-12 shrink-0 flex-row items-center justify-between rounded-t-lg border bg-surface px-4 py-2">
          <div className="flex min-w-0 flex-row items-center gap-3">
            <div className="text-sm font-medium text-foreground">{title}</div>
            {titleExtra ? <div>{titleExtra}</div> : null}
          </div>
          {rightExtra ? (
            <div className="ml-4 flex shrink-0 items-center gap-2">
              {rightExtra}
            </div>
          ) : null}
        </header>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden bg-surface",
          title ? "rounded-b-lg border border-t-0" : "rounded-lg border",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default PageContainer;
