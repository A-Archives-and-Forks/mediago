import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/utils";

function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const normalizedMax = Math.max(1, max);
  const normalizedValue = Math.min(normalizedMax, Math.max(0, value ?? 0));
  const percentage = (normalizedValue / normalizedMax) * 100;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-[#127AF3]/20",
        className,
      )}
      value={normalizedValue}
      max={normalizedMax}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-[#127AF3] transition-all"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
