import { cn } from "@/lib/utils";

export default function Skeleton({ className, variant = "text" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-200",
        variant === "text" && "h-4 w-full",
        variant === "circular" && "h-10 w-10 rounded-full",
        variant === "rectangular" && "h-24 w-full",
        className,
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-4 p-6 border border-gray-200 rounded-xl">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
