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
  className,
  animated = false
}) => {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-transform duration-300",
        sizeConfig[size],
        animated && "hover:scale-105 transition-transform duration-200 ease-out",
        className
      )}
    >
      <img
        src="/idesk-logo.png"
        alt="iDesk Logo"
        className="h-full w-auto object-contain filter drop-shadow-sm"
      />
    </div>
  );
};

export default Logo;
