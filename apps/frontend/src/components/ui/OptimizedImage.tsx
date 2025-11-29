import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

interface OptimizedImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    fallback?: React.ReactNode;
    lazy?: boolean;
    objectFit?: 'cover' | 'contain' | 'fill' | 'none';
    onLoad?: () => void;
    onError?: () => void;
}

/**
 * OptimizedImage component with:
 * - Lazy loading via Intersection Observer
 * - Loading skeleton state
 * - Error fallback
 * - Native lazy loading attribute
 * - Proper aspect ratio handling
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    width,
    height,
    className,
    fallback,
    lazy = true,
    objectFit = 'cover',
    onLoad,
    onError,
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isInView, setIsInView] = useState(!lazy);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!lazy) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                rootMargin: '50px', // Start loading 50px before entering viewport
                threshold: 0.01,
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [lazy]);

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

    // Default fallback component
    const defaultFallback = (
        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={cn('relative overflow-hidden', className)}
            style={{ width, height }}
        >
            {/* Loading skeleton */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse" />
            )}

            {/* Error state */}
            {hasError && (fallback || defaultFallback)}

            {/* Actual image */}
            {isInView && !hasError && (
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    width={width}
                    height={height}
                    loading={lazy ? 'lazy' : 'eager'}
                    decoding="async"
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn(
                        'w-full h-full transition-opacity duration-300',
                        objectFitClass,
                        isLoaded ? 'opacity-100' : 'opacity-0'
                    )}
                />
            )}
        </div>
    );
};

/**
 * Avatar image component with circular crop and initials fallback
 */
interface AvatarImageProps {
    src?: string | null;
    alt: string;
    size?: number;
    className?: string;
    fallbackInitials?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({
    src,
    alt,
    size = 40,
    className,
    fallbackInitials,
}) => {
    const [hasError, setHasError] = useState(false);

    // Get initials from alt text
    const initials = fallbackInitials || alt
        .split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    if (!src || hasError) {
        return (
            <div
                className={cn(
                    'rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold',
                    className
                )}
                style={{ width: size, height: size, fontSize: size * 0.4 }}
            >
                {initials}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
            className={cn('rounded-full object-cover', className)}
            style={{ width: size, height: size }}
        />
    );
};

export default OptimizedImage;
