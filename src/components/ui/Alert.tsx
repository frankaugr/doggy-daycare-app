import React from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { Button } from './Button';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = ''
}: AlertProps) {
  const variantConfig = {
    info: {
      icon: Info,
      containerClasses: 'bg-blue-50 border-blue-200',
      iconClasses: 'text-blue-600',
      titleClasses: 'text-blue-800',
      textClasses: 'text-blue-700'
    },
    success: {
      icon: CheckCircle,
      containerClasses: 'bg-green-50 border-green-200',
      iconClasses: 'text-green-600',
      titleClasses: 'text-green-800',
      textClasses: 'text-green-700'
    },
    warning: {
      icon: AlertCircle,
      containerClasses: 'bg-yellow-50 border-yellow-200',
      iconClasses: 'text-yellow-600',
      titleClasses: 'text-yellow-800',
      textClasses: 'text-yellow-700'
    },
    error: {
      icon: XCircle,
      containerClasses: 'bg-red-50 border-red-200',
      iconClasses: 'text-red-600',
      titleClasses: 'text-red-800',
      textClasses: 'text-red-700'
    }
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  const containerClasses = [
    'rounded-md border p-4',
    config.containerClasses,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconClasses}`} />
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${config.titleClasses}`}>
              {title}
            </h3>
          )}
          
          <div className={`${title ? 'mt-2' : ''} text-sm ${config.textClasses}`}>
            {children}
          </div>
        </div>
        
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                icon={X}
                className={`h-8 w-8 p-0 ${config.textClasses} hover:bg-opacity-20`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Toast-style alert that auto-dismisses
interface ToastProps extends Omit<AlertProps, 'dismissible'> {
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function Toast({
  duration = 5000,
  position = 'top-right',
  onDismiss,
  ...props
}: ToastProps) {
  React.useEffect(() => {
    if (duration > 0 && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-50',
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50'
  };

  return (
    <div className={positionClasses[position]}>
      <Alert
        {...props}
        dismissible
        onDismiss={onDismiss}
        className="shadow-lg max-w-md"
      />
    </div>
  );
}