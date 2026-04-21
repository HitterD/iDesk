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
      "relative rounded-2xl overflow-hidden flex items-center justify-center shadow-lg",
      sizeConfig[size].icon,
      animated && "hover:shadow-primary/40 hover:scale-105 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
      className
    )}
    style={{ boxShadow: '0 10px 40px -10px hsla(210, 100%, 55%, 0.35)' }}
  >
    <img
      src="/idesk-logo.png"
      alt="iDesk Logo"
      className="w-full h-full object-cover"
    />
    {/* Shine effect */}
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/15 to-transparent pointer-events-none" />
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
