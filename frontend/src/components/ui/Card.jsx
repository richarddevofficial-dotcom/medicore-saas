import { cn } from "@/lib/utils";

export default function Card({
  children,
  className,
  padding = true,
  hover = false,
  onClick,
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200",
        padding && "p-6",
        hover && "hover:shadow-md transition-shadow cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
