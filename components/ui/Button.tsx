
'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', fullWidth = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          'transform active:scale-95 hover:scale-105',
          {
            // Variants
            'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600': 
              variant === 'primary',
            'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600': 
              variant === 'secondary',
            'bg-transparent text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500': 
              variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600': 
              variant === 'destructive',
            // Sizes
            'px-3 py-1.5 text-sm rounded-md': size === 'sm',
            'px-4 py-2 text-base rounded-lg': size === 'md',
            'px-6 py-3 text-lg rounded-lg': size === 'lg',
            // Full width
            'w-full': fullWidth,
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';