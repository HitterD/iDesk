import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    className?: string;
    suffix?: string;
    prefix?: string;
    decimals?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    duration = 1000,
    className,
    suffix = '',
    prefix = '',
    decimals = 0,
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const startTimeRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);
    const previousValueRef = useRef(0);

    useEffect(() => {
        const startValue = previousValueRef.current;
        const endValue = value;
        
        if (startValue === endValue) return;

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) {
                startTimeRef.current = timestamp;
            }

            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const currentValue = startValue + (endValue - startValue) * easeOut;
            setDisplayValue(currentValue);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                previousValueRef.current = endValue;
                startTimeRef.current = null;
            }
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [value, duration]);

    const formattedValue = decimals > 0 
        ? displayValue.toFixed(decimals) 
        : Math.round(displayValue).toLocaleString();

    return (
        <span className={cn('tabular-nums', className)}>
            {prefix}{formattedValue}{suffix}
        </span>
    );
};

export default AnimatedNumber;
