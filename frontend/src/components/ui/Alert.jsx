import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";

const types = {
  success: {
    icon: CheckCircle,
    className: "bg-green-50 text-green-800 border-green-200",
    iconClass: "text-green-500",
  },
  error: {
    icon: AlertCircle,
    className: "bg-red-50 text-red-800 border-red-200",
    iconClass: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-yellow-50 text-yellow-800 border-yellow-200",
    iconClass: "text-yellow-500",
  },
  info: {
    icon: Info,
    className: "bg-blue-50 text-blue-800 border-blue-200",
    iconClass: "text-blue-500",
  },
};

export default function Alert({
  type = "info",
  title,
  message,
  onClose,
  className,
}) {
  const config = types[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        config.className,
        className,
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconClass)} />

      <div className="flex-1">
        {title && <h3 className="text-sm font-medium">{title}</h3>}
        {message && <p className="text-sm mt-0.5">{message}</p>}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-md p-1 hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
