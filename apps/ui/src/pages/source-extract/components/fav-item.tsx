import { Link as LinkIcon, X } from "lucide-react";
import { type ReactElement } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  onContextMenu?: () => void;
  onClick?: () => void;
  onClose?: () => void;
  src?: string;
  icon?: ReactElement;
  title?: string;
}

export function FavItem({
  onContextMenu,
  onClick,
  onClose,
  src,
  icon,
  title,
}: Props) {
  return (
    <div
      className="group relative flex min-h-28 w-28 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden"
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      {onClose ? (
        <div
          className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground group-hover:flex"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClose();
          }}
        >
          <X className="size-4 stroke-[1.75]" />
        </div>
      ) : null}
      <div className="flex h-14 w-14 flex-row items-center justify-center rounded-lg bg-white dark:bg-[#27292F]">
        <Avatar className="size-9 rounded-md bg-white text-[#27292F] dark:bg-[#27292F] dark:text-white">
          <AvatarImage src={src} alt={title || ""} />
          <AvatarFallback className="rounded-md bg-white text-[#27292F] dark:bg-[#27292F] dark:text-white">
            {icon ?? <LinkIcon className="size-5" />}
          </AvatarFallback>
        </Avatar>
      </div>
      <div
        className="w-full truncate text-center text-sm text-[#636D7E]"
        title={title}
      >
        {title}
      </div>
    </div>
  );
}
