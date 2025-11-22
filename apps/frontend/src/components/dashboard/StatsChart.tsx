import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const data = [
    { name: '00:00', tickets: 12 },
    { name: '04:00', tickets: 8 },
    { name: '08:00', tickets: 45 },
    { name: '12:00', tickets: 90 },
    { name: '16:00', tickets: 75 },
    { name: '20:00', tickets: 30 },
    { name: '23:59', tickets: 15 },
];

export const StatsChart: React.FC = () => {
    return (
        <div className="w-full h-[300px] bg-navy-main/50 border border-neon-green/20 rounded-lg p-4">
            <h3 className="text-neon-green font-mono mb-4">INCOMING TRAFFIC (24H)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#39ff14',
                            color: '#39ff14',
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="tickets"
                        stroke="#39ff14"
                        strokeWidth={2}
                        dot={{ fill: '#39ff14', r: 4 }}
                        activeDot={{ r: 6, fill: '#fff' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
