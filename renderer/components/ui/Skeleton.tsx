import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  style,
  ...props
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';
  
  const combinedStyle = {
    width,
    height,
    ...style
  };

  return (
    <div 
      className={`${baseClasses} ${className}`}
      style={combinedStyle}
      {...props}
    />
  );
};