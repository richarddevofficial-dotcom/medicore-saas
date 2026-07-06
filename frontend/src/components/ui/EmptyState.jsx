import Button from "./Button";
import { FileX, Plus } from "lucide-react";

export default function EmptyState({
  icon: Icon = FileX,
  title = "No data found",
  description = "Get started by creating your first entry.",
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>

      <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>

      {actionLabel && onAction && (
        <Button onClick={onAction} icon={Plus}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
