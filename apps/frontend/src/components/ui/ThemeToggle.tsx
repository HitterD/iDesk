import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme-provider';

interface ThemeToggleProps {
    className?: string;
    showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
    const { theme, setTheme } = useTheme();
    
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <button
            onClick={toggleTheme}
            className={`relative p-2.5 rounded-xl transition-all duration-300 hover:scale-105 ${
                isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            } ${className}`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            <div className="relative w-5 h-5">
                {/* Sun Icon - visible in dark mode */}
                <Sun 
                    className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                        isDark 
                            ? 'opacity-100 rotate-0 scale-100' 
                            : 'opacity-0 rotate-90 scale-0'
                    }`} 
                />
                {/* Moon Icon - visible in light mode */}
                <Moon 
                    className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                        isDark 
                            ? 'opacity-0 -rotate-90 scale-0' 
                            : 'opacity-100 rotate-0 scale-100'
                    }`} 
                />
            </div>
            {showLabel && (
                <span className="ml-2 text-sm font-medium">
                    {isDark ? 'Light' : 'Dark'}
                </span>
            )}
        </button>
    );
};

export default ThemeToggle;
