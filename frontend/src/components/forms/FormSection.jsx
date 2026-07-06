export default function FormSection({
  title,
  description,
  icon: Icon,
  children,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 pb-2 border-b border-gray-100">
        {Icon && (
          <div className="h-8 w-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary-600" />
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
