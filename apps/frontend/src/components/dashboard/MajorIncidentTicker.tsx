import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Incident {
    id: string;
    title: string;
}

export const MajorIncidentTicker: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);

    useEffect(() => {
        // Mock fetching critical incidents
        setIncidents([
            { id: '1', title: 'CRITICAL: Payment Gateway Down' },
            { id: '2', title: 'HIGH: API Latency Spike > 500ms' },
        ]);
    }, []);

    if (incidents.length === 0) return null;

    return (
        <div className="sticky top-0 z-50 bg-neon-orange/10 border-b border-neon-orange backdrop-blur-sm overflow-hidden h-10 flex items-center">
            <div className="flex items-center px-4 bg-neon-orange text-black font-bold h-full z-10">
                <AlertTriangle className="w-4 h-4 mr-2" />
                MAJOR INCIDENTS
            </div>
            <div className="animate-ticker whitespace-nowrap flex items-center text-neon-orange font-mono font-semibold">
                {incidents.map((incident) => (
                    <span key={incident.id} className="mx-8">
                        [{incident.id}] {incident.title}
                    </span>
                ))}
                {/* Duplicate for seamless loop */}
                {incidents.map((incident) => (
                    <span key={`dup-${incident.id}`} className="mx-8">
                        [{incident.id}] {incident.title}
                    </span>
                ))}
            </div>
        </div>
    );
};
