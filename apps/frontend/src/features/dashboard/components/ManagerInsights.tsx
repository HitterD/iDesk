import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Clock, CheckCircle, TrendingUp } from 'lucide-react';

const ticketData = [
    { name: 'Technical', value: 400 },
    { name: 'Billing', value: 300 },
    { name: 'Feature', value: 300 },
    { name: 'Other', value: 200 },
];

const COLORS = ['#39ff14', '#0088FE', '#FFBB28', '#FF8042'];

const agentPerformance = [
    { name: 'Agent A', tickets: 45 },
    { name: 'Agent B', tickets: 38 },
    { name: 'Agent C', tickets: 52 },
    { name: 'Agent D', tickets: 29 },
];

export const ManagerInsights: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-navy-main border border-white/10 p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 font-medium">Avg Resolution Time</h3>
                        <Clock className="text-neon-green w-5 h-5" />
                    </div>
                    <p className="text-3xl font-bold text-white">2h 15m</p>
                    <span className="text-xs text-neon-green flex items-center mt-2">
                        <TrendingUp className="w-3 h-3 mr-1" /> -15% vs last week
                    </span>
                </div>
                <div className="bg-navy-main border border-white/10 p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 font-medium">Resolution Rate</h3>
                        <CheckCircle className="text-blue-400 w-5 h-5" />
                    </div>
                    <p className="text-3xl font-bold text-white">94.2%</p>
                </div>
                <div className="bg-navy-main border border-white/10 p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 font-medium">Active Agents</h3>
                        <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                    </div>
                    <p className="text-3xl font-bold text-white">12/15</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-navy-main border border-white/10 p-6 rounded-xl h-[350px]">
                    <h3 className="text-white font-semibold mb-6">Tickets by Category</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={ticketData}
                                cx="50%"
                                cy="40%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {ticketData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333', color: '#fff' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-navy-main border border-white/10 p-6 rounded-xl h-[350px]">
                    <h3 className="text-white font-semibold mb-6">Top Performing Agents</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={agentPerformance} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                            <XAxis type="number" stroke="#666" />
                            <YAxis dataKey="name" type="category" stroke="#fff" width={80} />
                            <Tooltip
                                cursor={{ fill: '#ffffff10' }}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333', color: '#fff' }}
                            />
                            <Bar dataKey="tickets" fill="#39ff14" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
