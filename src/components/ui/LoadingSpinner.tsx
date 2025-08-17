import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const classes = [
    'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ');

  return <div className={classes} />;
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  text?: string;
}

export function LoadingOverlay({ isLoading, children, text }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="flex flex-col items-center space-y-2">
            <LoadingSpinner size="lg" />
            {text && <p className="text-sm text-gray-600">{text}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  if (count === 1) {
    return <div className={classes} />;
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={classes} />
      ))}
    </>
  );
}