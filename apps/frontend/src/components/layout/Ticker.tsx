import React from 'react';

const incidents = [
    'CRITICAL: Server Outage in US-East',
    'WARNING: High Latency in DB Cluster',
    'INFO: Scheduled Maintenance at 02:00 UTC',
    'CRITICAL: Payment Gateway Timeout',
];

export const Ticker: React.FC = () => {
    return (
        <div className="sticky top-0 z-50 w-full bg-black/80 border-b border-primary/50 overflow-hidden h-10 flex items-center backdrop-blur-sm">
            <div className="whitespace-nowrap animate-ticker flex space-x-8">
                {incidents.map((incident, index) => (
                    <span
                        key={index}
                        className={`font-mono text-sm font-bold ${incident.startsWith('CRITICAL')
                                ? 'text-red-500'
                                : incident.startsWith('WARNING')
                                    ? 'text-warning'
                                    : 'text-primary'
                            }`}
                    >
                        {incident}
                    </span>
                ))}
                {/* Duplicate for seamless loop */}
                {incidents.map((incident, index) => (
                    <span
                        key={`dup-${index}`}
                        className={`font-mono text-sm font-bold ${incident.startsWith('CRITICAL')
                                ? 'text-red-500'
                                : incident.startsWith('WARNING')
                                    ? 'text-warning'
                                    : 'text-primary'
                            }`}
                    >
                        {incident}
                    </span>
                ))}
            </div>
        </div>
    );
};
