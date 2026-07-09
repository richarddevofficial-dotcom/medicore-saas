import Button from "./Button";
import { FileX, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmptyState({
  icon: Icon = FileX,
  imageSrc,
  imageAlt = "Empty state illustration",
  imageClassName,
  title = "No data found",
  description = "Get started by creating your first entry.",
  actionLabel,
  onAction,
  className,
  titleClassName,
  descriptionClassName,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className,
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className={cn("w-44 h-auto opacity-90 mb-3", imageClassName)}
        />
      ) : (
        <div className="rounded-full bg-gray-100 p-4 mb-4">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}

      {title && (
        <h3
          className={cn(
            "text-lg font-medium text-gray-900 mb-1",
            titleClassName,
          )}
        >
          {title}
        </h3>
      )}

      {description && (
        <p
          className={cn(
            "text-sm text-gray-500 max-w-sm mb-6",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button onClick={onAction} icon={Plus}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
