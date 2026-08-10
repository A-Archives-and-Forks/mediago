import { cn } from "@/utils";
import LogoImg from "../assets/images/logo.png";

interface AppBrandProps {
  className?: string;
}

export function AppBrand({ className }: AppBrandProps) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 select-none items-center border-b px-3",
        className,
      )}
    >
      <img className="mr-2 size-7" src={LogoImg} alt="Media Go" />
      <span className="text-base font-semibold whitespace-nowrap">
        Media Go
      </span>
      <span className="ml-2 text-xs text-muted-foreground">
        v{import.meta.env.APP_VERSION}
      </span>
    </div>
  );
}
