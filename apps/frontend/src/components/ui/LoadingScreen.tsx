import React from 'react';
import { Logo } from './Logo';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="animate-blur-in">
          <Logo size="xl" variant="icon" className="mx-auto mb-6 animate-floating" />
        </div>
        
        {/* Text Logo */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <Logo size="lg" variant="text" />
        </div>
        
        {/* Loading Indicator */}
        <div className="mt-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          
          {message && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline loading spinner
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ 
  size = 'md',
  className 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div 
      className={`${sizeClasses[size]} border-primary/30 border-t-primary rounded-full animate-spin ${className}`}
    />
  );
};

// Loading dots
export const LoadingDots: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

export default LoadingScreen;
