const fs = require('fs');
const file = 'D:\\iDesk-main\\apps\\frontend\\src\\features\\dashboard\\pages\\BentoDashboardPage.tsx';
let content = fs.readFileSync(file, 'utf16le');

// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
}

const startComponents = content.indexOf('// Simple Bar Chart Component');
const endComponents = content.indexOf('export const BentoDashboardPage');

if (startComponents !== -1 && endComponents !== -1) {
    const importStatement = `import { MiniBarChart, DonutChart, StatCard, StatusBadge, PriorityDot } from '../components/DashboardComponents';\n\n`;
    content = content.substring(0, startComponents) + importStatement + content.substring(endComponents);
} else {
    console.log('Could not find components block');
    console.log('start:', startComponents, 'end:', endComponents);
    process.exit(1);
}

const ticketsQueryStart = content.indexOf('const { data: tickets');
const ticketsQueryEnd = content.indexOf('});', ticketsQueryStart) + 3;
if (ticketsQueryStart !== -1) {
    content = content.substring(0, ticketsQueryStart) + content.substring(ticketsQueryEnd);
} else {
    console.log('Could not find tickets query');
    process.exit(1);
}

const liveStatsStart = content.indexOf('const liveStats = useMemo(() => {');
const liveStatsEnd = content.indexOf('}, [tickets, chartDateRange]);', liveStatsStart) + 30;
if (liveStatsStart !== -1) {
    content = content.substring(0, liveStatsStart) + content.substring(liveStatsEnd);
} else {
    console.log('Could not find liveStats useMemo');
    process.exit(1);
}

const statsQueryStart = content.indexOf('const { data: stats, isLoading, isError: statsError, error: statsErrorData, refetch: refetchStats } = useQuery<DashboardStats>({');
const statsQueryEnd = content.indexOf('});', statsQueryStart) + 3;
if (statsQueryStart !== -1) {
    const newStatsQuery = `const { data: stats, isLoading, isError: statsError, error: statsErrorData, refetch: refetchStats, dataUpdatedAt } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats', chartDateRange],
        queryFn: async () => {
            const res = await api.get('/tickets/dashboard/stats', { params: { days: chartDateRange } });
            return res.data;
        },
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
    });`;
    content = content.substring(0, statsQueryStart) + newStatsQuery + content.substring(statsQueryEnd);
} else {
    console.log('Could not find stats query');
    process.exit(1);
}

content = content.replace(/refetchTickets\(\);\n\s*/g, '');
content = content.replace(/if \(ticketsError \|\| statsError\) \{/, 'if (statsError) {');
content = content.replace(/const errorMessage = \(ticketsErrorData as Error\)\?\.message \|\| \(statsErrorData as Error\)\?\.message \|\| 'Failed to load dashboard data';/, `const errorMessage = (statsErrorData as Error)?.message || 'Failed to load dashboard data';`);
content = content.replace(/if \(isLoading && tickets\.length === 0\) \{/, 'if (isLoading && !stats) {');

content = content.replace(/liveStats\.open/g, '(stats?.open || 0)');
content = content.replace(/liveStats\.inProgress/g, '(stats?.inProgress || 0)');
content = content.replace(/liveStats\.waitingVendor/g, '(stats?.waitingVendor || 0)');
content = content.replace(/liveStats\.resolved/g, '(stats?.resolved || 0)');
content = content.replace(/liveStats\.cancelled/g, '(stats?.cancelled || 0)');
content = content.replace(/liveStats\.overdue/g, '(stats?.overdue || 0)');
content = content.replace(/liveStats\.total/g, '(stats?.total || 0)');
content = content.replace(/liveStats\.byPriority\.CRITICAL/g, '(stats?.byPriority?.CRITICAL || 0)');
content = content.replace(/liveStats\.byPriority\.HIGH/g, '(stats?.byPriority?.HIGH || 0)');
content = content.replace(/liveStats\.byPriority\.MEDIUM/g, '(stats?.byPriority?.MEDIUM || 0)');
content = content.replace(/liveStats\.byPriority\.LOW/g, '(stats?.byPriority?.LOW || 0)');
content = content.replace(/liveStats\.last7Days/g, '(stats?.last7Days || [])');
content = content.replace(/liveStats\.recentTickets/g, '(stats?.recentTickets || [])');
content = content.replace(/liveStats\.slaCompliance/g, '(stats?.slaCompliance || 0)');
content = content.replace(/liveStats\.byCategory/g, '(stats?.byCategory || {})');
content = content.replace(/liveStats\.topAgents/g, '(stats?.topAgents || [])');

fs.writeFileSync(file, content, 'utf8');
console.log('Success');
