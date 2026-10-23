import React from 'react';
import { ResponsiveContainer } from 'recharts';

/** Recharts starts at -1×-1 until the ResizeObserver fires, which logs a size warning on every chart mount. */
const INITIAL_DIMENSION = { width: 1, height: 1 } as const;

/** ResponsiveContainer with a positive first-render size; use it for every responsive chart. */
export const ResponsiveChart: React.FC<React.ComponentProps<typeof ResponsiveContainer>> = (props) => (
    <ResponsiveContainer initialDimension={INITIAL_DIMENSION} {...props} />
);
