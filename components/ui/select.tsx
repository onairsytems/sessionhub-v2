import React from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

// Simple implementations for compatibility
export const SelectContent: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const SelectItem: React.FC<React.OptionHTMLAttributes<HTMLOptionElement>> = (props) => <option {...props} />;
export const SelectTrigger: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const SelectValue: React.FC<{ placeholder?: string }> = () => null;