import React from 'react';
import { Check, Minus } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, indeterminate = false, disabled = false, className = '' }: CheckboxProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        w-4 h-4 rounded border-2 transition-colors duration-200 flex items-center justify-center
        ${checked || indeterminate 
          ? 'bg-blue-600 border-blue-600 text-white' 
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {indeterminate ? (
        <Minus className="w-3 h-3" />
      ) : checked ? (
        <Check className="w-3 h-3" />
      ) : null}
    </button>
  );
}