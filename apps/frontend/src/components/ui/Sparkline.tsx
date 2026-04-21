import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  showDot?: boolean;
  filled?: boolean;
  className?: string;
}

const colorMap = {
  primary: { stroke: '#2196F3', fill: 'rgba(33, 150, 243, 0.1)' },
  success: { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.1)' },
  warning: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.1)' },
  danger: { stroke: '#EF4444', fill: 'rgba(239, 68, 68, 0.1)' },
  info: { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.1)' },
};

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 32,
  color = 'primary',
  showDot = true,
  filled = false,
  className,
}) => {
  const { pathD, areaD, points, lastPoint } = useMemo(() => {
    if (!data || data.length === 0) {
      return { pathD: '', areaD: '', points: [], lastPoint: null };
    }

    const padding = 4;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const pts = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
      return { x, y, value };
    });

    const pathD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

    return {
      pathD,
      areaD,
      points: pts,
      lastPoint: pts[pts.length - 1],
    };
  }, [data, width, height]);

  if (!data || data.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center text-slate-400 text-xs", className)}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const colors = colorMap[color];
  const trend = data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'neutral';

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Filled area */}
      {filled && (
        <path
          d={areaD}
          fill={colors.fill}
          className="transition-[opacity,transform,colors] duration-200 ease-out"
        />
      )}

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-[opacity,transform,colors] duration-200 ease-out"
      />

      {/* End dot */}
      {showDot && lastPoint && (
        <>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4}
            fill="white"
            stroke={colors.stroke}
            strokeWidth={2}
            className="transition-[opacity,transform,colors] duration-200 ease-out"
          />
          {/* Pulse animation */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4}
            fill={colors.stroke}
            className="animate-ping opacity-75"
            style={{ transformOrigin: `${lastPoint.x}px ${lastPoint.y}px` }}
          />
        </>
      )}
    </svg>
  );
};

// Trend indicator with sparkline
interface TrendSparklineProps extends SparklineProps {
  label?: string;
  value?: string | number;
  showTrend?: boolean;
}

export const TrendSparkline: React.FC<TrendSparklineProps> = ({
  data,
  label,
  value,
  showTrend = true,
  ...sparklineProps
}) => {
  const trend = useMemo(() => {
    if (!data || data.length < 2) return 0;
    const first = data[0];
    const last = data[data.length - 1];
    if (first === 0) return last > 0 ? 100 : 0;
    return ((last - first) / first) * 100;
  }, [data]);

  const trendColor = trend > 0 ? 'success' : trend < 0 ? 'danger' : 'primary';

  return (
    <div className="flex items-center gap-3">
      <Sparkline data={data} color={trendColor} {...sparklineProps} />
      {showTrend && (
        <div className="flex flex-col items-end">
          {value !== undefined && (
            <span className="text-sm font-bold text-slate-800 dark:text-white">{value}</span>
          )}
          <span className={cn(
            "text-xs font-medium",
            trend > 0 && "text-green-600",
            trend < 0 && "text-red-600",
            trend === 0 && "text-slate-500"
          )}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default Sparkline;
