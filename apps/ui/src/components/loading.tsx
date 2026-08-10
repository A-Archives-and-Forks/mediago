import type { FC } from "react";
import { Spinner } from "@/components/ui/spinner";

const Loading: FC = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white dark:bg-[#1F2024]">
      <Spinner />
    </div>
  );
};

export default Loading;
