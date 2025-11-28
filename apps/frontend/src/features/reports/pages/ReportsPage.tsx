import { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, BarChart3 } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

interface MonthlyStats {
    month: number;
    year: number;
    totalTickets: number;
    resolvedTickets: number;
    openTickets: number;
    avgResolutionTimeHours: string;
}

export const ReportsPage = () => {
    const [month, setMonth] = useState<string>(new Date().getMonth() + 1 + '');
    const [year, setYear] = useState<string>(new Date().getFullYear() + '');
    const [stats, setStats] = useState<MonthlyStats | null>(null);
    const [loading, setLoading] = useState(false);

    // Use loading to show a spinner or disable button if needed
    if (loading) {
        // Optional: Add loading state UI
    }

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/reports/monthly?month=${month}&year=${year}`);
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [month, year]);

    const handleDownload = async () => {
        try {
            const response = await api.get(`/reports/export/excel?month=${month}&year=${year}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report-${month}-${year}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download report:', error);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Monthly Reports</h1>
                    <p className="text-slate-400">Analyze performance and export data.</p>
                </div>
                <div className="flex gap-4">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-[120px] bg-navy-light border-white/10 text-white">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <SelectItem key={m} value={m.toString()}>
                                    {new Date(0, m - 1).toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Jakarta' })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-[100px] bg-navy-light border-white/10 text-white">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleDownload}
                        className="bg-neon-green text-navy-dark hover:bg-neon-green/90 font-bold"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-navy-light border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Total Tickets</CardTitle>
                            <FileSpreadsheet className="h-4 w-4 text-neon-blue" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.totalTickets}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-navy-light border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Resolved</CardTitle>
                            <BarChart3 className="h-4 w-4 text-neon-green" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.resolvedTickets}</div>
                            <p className="text-xs text-slate-500 mt-1">
                                {stats.totalTickets > 0 ? ((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1) : 0}% Resolution Rate
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-navy-light border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Open Tickets</CardTitle>
                            <div className="h-4 w-4 text-neon-orange">⚠️</div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.openTickets}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-navy-light border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Avg Resolution Time</CardTitle>
                            <div className="h-4 w-4 text-purple-400">⏱️</div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.avgResolutionTimeHours}h</div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
