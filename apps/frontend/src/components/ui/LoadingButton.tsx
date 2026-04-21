/**
 * LoadingButton Component
 * Button with built-in loading state and spinner
 */

import * as React from 'react';
import { Button, ButtonProps } from './button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingButtonProps extends ButtonProps {
    /** Show loading spinner and disable button */
    loading?: boolean;
    /** Text to show while loading (default: shows children) */
    loadingText?: string;
    /** Position of spinner relative to text */
    spinnerPosition?: 'left' | 'right';
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
    (
        {
            children,
            loading = false,
            loadingText,
            spinnerPosition = 'left',
            disabled,
            className,
            ...props
        },
        ref
    ) => {
        const spinner = (
            <Loader2 className="h-4 w-4 animate-spin" />
        );

        return (
            <Button
                ref={ref}
                disabled={disabled || loading}
                className={cn(
                    'relative transition-[opacity,transform,colors] duration-200 ease-out',
                    loading && 'cursor-not-allowed',
                    className
                )}
                {...props}
            >
                {/* Loading State */}
                {loading && spinnerPosition === 'left' && (
                    <span className="mr-2">{spinner}</span>
                )}

                {/* Content */}
                <span className={cn(loading && !loadingText && 'opacity-0')}>
                    {children}
                </span>

                {/* Loading Text (absolute overlay if showing original children) */}
                {loading && loadingText && (
                    <span>{loadingText}</span>
                )}

                {/* Centered spinner when no loadingText */}
                {loading && !loadingText && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        {spinner}
                    </span>
                )}

                {loading && spinnerPosition === 'right' && loadingText && (
                    <span className="ml-2">{spinner}</span>
                )}
            </Button>
        );
    }
);

LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
