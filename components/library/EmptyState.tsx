import { ReactNode } from 'react';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function EmptyState({ message, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-4 text-muted-foreground">
        {icon || <FileText className="w-16 h-16" />}
      </div>
      <p className="text-lg text-muted-foreground mb-6 text-center max-w-md">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}