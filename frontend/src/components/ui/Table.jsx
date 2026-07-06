import { cn } from '@/lib/utils';

export function Table({ children, className }) {
  return (
    <div className="w-full min-w-[800px]">
      <table className={cn('min-w-full divide-y divide-gray-200', className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }) {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function TableBody({ children }) {
  return <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>;
}

export function TableRow({ children, className, onClick, clickable = false }) {
  return (
    <tr className={cn(clickable && 'cursor-pointer hover:bg-gray-50', className)} onClick={onClick}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className }) {
  return (
    <th className={cn('px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider', className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className }) {
  return (
    <td className={cn('px-4 py-3 whitespace-nowrap text-sm text-gray-900', className)}>
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan = 1, message = 'No data found' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-gray-500">
        {message}
      </td>
    </tr>
  );
}
