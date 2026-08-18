import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
  animated?: boolean;
}

const sizeConfig = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-20',
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  className,
  animated = false
}) => {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-transform duration-200",
        sizeConfig[size],
        variant === 'icon' ? "w-10 h-10" : "",
        animated && "hover:scale-105 transition-transform duration-200 ease-out",
        className
      )}
    >
      <img
        src="/idesk-logo.png"
        alt="iDesk Logo"
        className={cn(
          "h-full w-auto object-contain filter drop-shadow-xs",
          variant === 'icon' ? "max-h-9 max-w-full" : ""
        )}
      />
    </div>
  );
};

export default Logo;


