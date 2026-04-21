import React, { useState, useRef, useEffect } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
    fallbackIcon?: React.ReactNode;
    blurDataURL?: string;
    lazy?: boolean;
    objectFit?: 'cover' | 'contain' | 'fill' | 'none';
    onLoad?: () => void;
    onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    className,
    containerClassName,
    fallbackIcon,
    blurDataURL,
    lazy = true,
    objectFit = 'cover',
    onLoad,
    onError,
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isInView, setIsInView] = useState(!lazy);
    const containerRef = useRef<HTMLDivElement>(null);

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (!lazy || isInView) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [lazy, isInView]);

    const handleLoad = () => {
        setIsLoaded(true);
        onLoad?.();
    };

    const handleError = () => {
        setHasError(true);
        onError?.();
    };

    const objectFitClass = {
        cover: 'object-cover',
        contain: 'object-contain',
        fill: 'object-fill',
        none: 'object-none',
    }[objectFit];

    return (
        <div
            ref={containerRef}
            className={cn('relative overflow-hidden', containerClassName)}
        >
            {/* Blur placeholder or loading state */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700">
                    {blurDataURL ? (
                        <img
                            src={blurDataURL}
                            alt=""
                            className={cn('w-full h-full blur-lg scale-110', objectFitClass)}
                            aria-hidden="true"
                        />
                    ) : (
                        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                </div>
            )}

            {/* Main image */}
            {isInView && !hasError && (
                <img
                    src={src}
                    alt={alt}
                    loading={lazy ? 'lazy' : 'eager'}
                    className={cn(
                        'w-full h-full transition-opacity duration-300',
                        objectFitClass,
                        isLoaded ? 'opacity-100' : 'opacity-0',
                        className
                    )}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}

            {/* Error state */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                    {fallbackIcon || (
                        <div className="text-center">
                            <ImageOff className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <span className="text-xs text-slate-400">Failed to load</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Avatar variant with circular shape
interface OptimizedAvatarProps extends Omit<OptimizedImageProps, 'objectFit'> {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    fallbackInitials?: string;
}

const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
};

export const OptimizedAvatar: React.FC<OptimizedAvatarProps> = ({
    src,
    alt,
    size = 'md',
    fallbackInitials,
    className,
    ...props
}) => {
    const [hasError, setHasError] = useState(false);

    if (hasError || !src) {
        return (
            <div
                className={cn(
                    'rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-primary to-primary/70',
                    sizeClasses[size],
                    className
                )}
            >
                {fallbackInitials || alt?.charAt(0)?.toUpperCase() || '?'}
            </div>
        );
    }

    return (
        <OptimizedImage
            src={src}
            alt={alt}
            containerClassName={cn('rounded-full', sizeClasses[size])}
            className={cn('rounded-full', className)}
            objectFit="cover"
            onError={() => setHasError(true)}
            {...props}
        />
    );
};

export default OptimizedImage;
