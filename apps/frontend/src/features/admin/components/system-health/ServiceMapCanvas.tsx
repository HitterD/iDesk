import React, { useEffect, useRef, useState, useMemo } from 'react';
import { EndToEndTrace, ServiceNodeData, ServiceTier } from './serviceMapTypes';
import { ServiceNodeCard } from './ServiceNodeCard';

interface ServiceMapCanvasProps {
    nodes: ServiceNodeData[];
    activeTrace: EndToEndTrace;
    selectedNodeId: string | null;
    onSelectNode: (nodeId: string) => void;
}

interface NodePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

const TIER_ORDER: { tier: ServiceTier; title: string; subtitle: string }[] = [
    { tier: 'client', title: '1. Client Edge', subtitle: 'Web & Mobile Portal' },
    { tier: 'gateway', title: '2. API Gateway', subtitle: 'Reverse Proxy & Security' },
    { tier: 'core', title: '3. Core Microservices', subtitle: 'Business Logic & Rules' },
    { tier: 'storage', title: '4. Infrastructure & DB', subtitle: 'PostgreSQL, Redis & Sockets' },
    { tier: 'external', title: '5. External Cloud APIs', subtitle: 'Mail, Telegram & Zoom' },
];

export const ServiceMapCanvas: React.FC<ServiceMapCanvasProps> = ({
    nodes,
    activeTrace,
    selectedNodeId,
    onSelectNode,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Group nodes by tier
    const nodesByTier = useMemo(() => {
        const groups: Record<ServiceTier, ServiceNodeData[]> = {
            client: [],
            gateway: [],
            core: [],
            storage: [],
            external: [],
        };
        for (const n of nodes) {
            if (groups[n.tier]) {
                groups[n.tier].push(n);
            }
        }
        return groups;
    }, [nodes]);

    // Recalculate node coordinate positions for SVG bezier curves
    useEffect(() => {
        const calculatePositions = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newPos = new Map<string, NodePosition>();

            nodeRefs.current.forEach((el, id) => {
                if (el) {
                    const rect = el.getBoundingClientRect();
                    newPos.set(id, {
                        x: rect.left - containerRect.left + containerRef.current!.scrollLeft,
                        y: rect.top - containerRect.top + containerRef.current!.scrollTop,
                        width: rect.width,
                        height: rect.height,
                    });
                }
            });

            setPositions(newPos);
        };

        calculatePositions();
        window.addEventListener('resize', calculatePositions);
        const timer = setTimeout(calculatePositions, 80);

        return () => {
            window.removeEventListener('resize', calculatePositions);
            clearTimeout(timer);
        };
    }, [nodes, activeTrace]);

    return (
        <div className="relative w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-b from-slate-50/70 to-slate-100/40 dark:from-slate-950/70 dark:to-slate-900/40 p-5 sm:p-7 overflow-x-auto min-h-[490px] custom-scrollbar select-none shadow-xs">
            {/* Background SVG Canvas for Bezier Connection Curves (Datadog Style) */}
            <svg
                className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible"
                style={{ minWidth: '1120px' }}
            >
                <defs>
                    <linearGradient id="healthyFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
                        <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
                    </linearGradient>

                    <linearGradient id="errorFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity="0.9" />
                    </linearGradient>

                    {/* Particle Glow Filters */}
                    <filter id="packetGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="errorPacketGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {activeTrace.connections.map((conn, idx) => {
                    const fromPos = positions.get(conn.from);
                    const toPos = positions.get(conn.to);

                    if (!fromPos || !toPos) return null;

                    // Source anchor: right-middle of source card
                    const startX = fromPos.x + fromPos.width;
                    const startY = fromPos.y + fromPos.height / 2;

                    // Destination anchor: left-middle of target card
                    const endX = toPos.x;
                    const endY = toPos.y + toPos.height / 2;

                    // Forward Cubic Bezier curve control points
                    const dx = Math.max(35, Math.abs(endX - startX) * 0.48);
                    const cp1x = startX + dx;
                    const cp1y = startY;
                    const cp2x = endX - dx;
                    const cp2y = endY;

                    const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                    const isError = conn.status === 'error';

                    const isRelevantToHover =
                        !hoveredNodeId || hoveredNodeId === conn.from || hoveredNodeId === conn.to;

                    const opacity = isRelevantToHover ? 1 : 0.2;

                    return (
                        <g key={`${conn.from}-${conn.to}-${idx}`} style={{ opacity, transition: 'opacity 0.2s ease' }}>
                            {/* Base track curve */}
                            <path
                                d={pathD}
                                fill="none"
                                stroke={isError ? "rgba(244, 63, 94, 0.3)" : "rgba(148, 163, 184, 0.25)"}
                                strokeWidth={isError ? 3 : 2}
                                strokeLinecap="round"
                            />

                            {/* Flowing stroke with dash animation */}
                            <path
                                id={`path-${idx}`}
                                d={pathD}
                                fill="none"
                                stroke={isError ? "url(#errorFlowGrad)" : "url(#healthyFlowGrad)"}
                                strokeWidth={isError ? 2.5 : 2}
                                strokeDasharray="5, 7"
                                className={isError ? "animate-[dash_1s_linear_infinite]" : "animate-[dash_2.2s_linear_infinite]"}
                            />

                            {/* Real-Time Glowing Traveling Packet Particle (SVG animateMotion) */}
                            <circle
                                r={isError ? 4.5 : 3.5}
                                fill={isError ? "#ff2a55" : "#06b6d4"}
                                filter={isError ? "url(#errorPacketGlow)" : "url(#packetGlow)"}
                            >
                                <animateMotion
                                    path={pathD}
                                    dur={isError ? "1.4s" : "2.4s"}
                                    repeatCount="indefinite"
                                    rotate="auto"
                                />
                            </circle>
                        </g>
                    );
                })}
            </svg>

            {/* Canvas Nodes Columns */}
            <div
                ref={containerRef}
                className="relative z-10 grid grid-cols-5 gap-7 sm:gap-9 min-w-[1120px]"
            >
                {TIER_ORDER.map(({ tier, title, subtitle }) => {
                    const tierNodes = nodesByTier[tier] || [];

                    return (
                        <div key={tier} className="flex flex-col">
                            {/* Tier Column Header */}
                            <div className="mb-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide uppercase">
                                    {title}
                                </h3>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                    {subtitle}
                                </p>
                            </div>

                            {/* Node Cards in this Column */}
                            <div className="flex flex-col gap-4 my-auto">
                                {tierNodes.map((node) => {
                                    const isActiveInTrace = activeTrace.activeNodes.includes(node.id);
                                    const isSelected = selectedNodeId === node.id;

                                    return (
                                        <div
                                            key={node.id}
                                            ref={(el) => {
                                                if (el) nodeRefs.current.set(node.id, el);
                                                else nodeRefs.current.delete(node.id);
                                            }}
                                            onMouseEnter={() => setHoveredNodeId(node.id)}
                                            onMouseLeave={() => setHoveredNodeId(null)}
                                        >
                                            <ServiceNodeCard
                                                node={node}
                                                isActiveInTrace={isActiveInTrace}
                                                isSelected={isSelected}
                                                onClick={() => onSelectNode(node.id)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
