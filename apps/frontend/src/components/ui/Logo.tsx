import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
  animated?: boolean;
}

const sizeConfig = {
  xs: { icon: 'w-6 h-6', text: 'text-sm', iconText: 'text-[10px]' },
  sm: { icon: 'w-8 h-8', text: 'text-lg', iconText: 'text-xs' },
  md: { icon: 'w-10 h-10', text: 'text-xl', iconText: 'text-sm' },
  lg: { icon: 'w-12 h-12', text: 'text-2xl', iconText: 'text-base' },
  xl: { icon: 'w-16 h-16', text: 'text-3xl', iconText: 'text-xl' },
};

const IconLogo: React.FC<{ size: keyof typeof sizeConfig; animated?: boolean; className?: string }> = ({ 
  size, 
  animated,
  className 
}) => (
  <div 
    className={cn(
      "relative rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-600 flex items-center justify-center shadow-lg",
      sizeConfig[size].icon,
      animated && "hover:shadow-primary/40 hover:scale-105 transition-all duration-300",
      className
    )}
    style={{ boxShadow: '0 10px 40px -10px hsla(150, 50%, 50%, 0.35)' }}
  >
    {/* iD Monogram */}
    <svg viewBox="0 0 40 40" fill="none" className="w-[65%] h-[65%]">
      {/* i dot */}
      <circle cx="11" cy="9" r="2.5" fill="white" />
      {/* i stem */}
      <rect x="9" y="14" width="4" height="14" rx="2" fill="white" />
      {/* D letter */}
      <path 
        d="M18 8h5c6 0 10 4 10 12s-4 12-10 12h-5V8z" 
        stroke="white" 
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Connection bar */}
      <rect x="13" y="18" width="5" height="3" rx="1.5" fill="white" opacity="0.9" />
    </svg>
    
    {/* Shine effect */}
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/25 to-transparent pointer-events-none" />
  </div>
);

const TextLogo: React.FC<{ size: keyof typeof sizeConfig; className?: string }> = ({ size, className }) => (
  <span className={cn("font-bold tracking-tight", sizeConfig[size].text, className)}>
    <span className="text-slate-800 dark:text-white">i</span>
    <span className="text-primary">Desk</span>
  </span>
);

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className,
  animated = false
}) => {
  if (variant === 'icon') {
    return <IconLogo size={size} animated={animated} className={className} />;
  }
  
  if (variant === 'text') {
    return <TextLogo size={size} className={className} />;
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <IconLogo size={size} animated={animated} />
      <TextLogo size={size} />
    </div>
  );
};

export default Logo;
