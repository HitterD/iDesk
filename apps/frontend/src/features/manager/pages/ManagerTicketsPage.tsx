import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Ticket,
    Search,
    RefreshCw,
    Eye,
    AlertTriangle,
    Clock,
    CheckCircle,
    Filter,
} from 'lucide-react';
import { SiteSelector } from '@/components/site/SiteSelector';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import api from '@/lib/api';

interface TicketData {
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    user?: { fullName: string };
    site?: { code: string; name: string };
    assignedTo?: { fullName: string };
    category?: { name: string };
}

const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-green-500',
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    TODO: { label: 'To Do', icon: Clock, color: 'bg-slate-500' },
    IN_PROGRESS: { label: 'In Progress', icon: RefreshCw, color: 'bg-blue-500' },
    AWAITING: { label: 'Awaiting', icon: Clock, color: 'bg-yellow-500' },
    RESOLVED: { label: 'Resolved', icon: CheckCircle, color: 'bg-green-500' },
};

export const ManagerTicketsPage = () => {
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');

    const { data: ticketsData, isLoading, refetch, isError, error } = useQuery({
        queryKey: ['manager-tickets', selectedSites, statusFilter, priorityFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedSites.length > 0) {
                selectedSites.forEach(id => params.append('siteIds', id));
            }
            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (priorityFilter !== 'all') {
                params.append('priority', priorityFilter);
            }
            params.append('limit', '100');

            // Use /tickets/paginated endpoint which supports siteIds filter and includes site relation
            const res = await api.get(`/tickets/paginated?${params.toString()}`);
            return res.data;
        },
    });

    // Defensive: ensure tickets is always an array
    const rawData = ticketsData?.data;
    const tickets: TicketData[] = Array.isArray(rawData) ? rawData : [];

    const filteredTickets = tickets.filter(ticket => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            ticket.ticketNumber?.toLowerCase().includes(query) ||
            ticket.title?.toLowerCase().includes(query) ||
            ticket.user?.fullName?.toLowerCase().includes(query)
        );
    });

    const getStatusBadge = (status: string) => {
        const config = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-500' };
        return (
            <Badge className={`${config.color} text-white`}>
                {config.label}
            </Badge>
        );
    };

    const getPriorityBadge = (priority: string) => {
        return (
            <Badge className={`${PRIORITY_COLORS[priority] || 'bg-slate-500'} text-white`}>
                {priority}
            </Badge>
        );
    };

    // Stats
    const stats = {
        total: tickets.length,
        critical: tickets.filter(t => t.priority === 'CRITICAL').length,
        open: tickets.filter(t => ['TODO', 'IN_PROGRESS', 'AWAITING'].includes(t.status)).length,
        resolved: tickets.filter(t => t.status === 'RESOLVED').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Ticket className="w-6 h-6 text-primary" />
                        </div>
                        Ticket Overview
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor tiket dari semua site
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-red-200 dark:border-red-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Critical
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Filter
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <SiteSelector
                                selectedSiteIds={selectedSites}
                                onSelectionChange={setSelectedSites}
                                mode="multi"
                            />
                        </div>
                        <div className="w-[150px]">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="TODO">To Do</SelectItem>
                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                    <SelectItem value="AWAITING">Awaiting</SelectItem>
                                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-[150px]">
                            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priority</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="LOW">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative w-[250px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tickets Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ticket</TableHead>
                                    <TableHead>Site</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Requester</TableHead>
                                    <TableHead>Assigned To</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTickets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No tickets found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTickets.map((ticket) => (
                                        <TableRow key={ticket.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">{ticket.ticketNumber}</div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {ticket.title}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {ticket.site ? (
                                                    <Badge variant="outline">{ticket.site.code}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                            <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                                            <TableCell>
                                                <span className="text-sm">{ticket.user?.fullName || '-'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">{ticket.assignedTo?.fullName || 'Unassigned'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDistanceToNow(new Date(ticket.createdAt), {
                                                        addSuffix: true,
                                                        locale: idLocale,
                                                    })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" title="View details">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ManagerTicketsPage;
