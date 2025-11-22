import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

// Mock API
const fetchMyTickets = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [
        {
            id: '1',
            title: 'Cannot access VPN',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            updatedAt: new Date().toISOString(),
        },
        {
            id: '2',
            title: 'Request for new monitor',
            status: 'TODO',
            priority: 'LOW',
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
            id: '3',
            title: 'Email sync issues',
            status: 'RESOLVED',
            priority: 'MEDIUM',
            updatedAt: new Date(Date.now() - 172800000).toISOString(),
        },
    ];
};

const statusColors: any = {
    TODO: 'bg-slate-100 text-slate-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    WAITING: 'bg-yellow-100 text-yellow-800',
    RESOLVED: 'bg-green-100 text-green-800',
};

export const MyTicketsPage: React.FC = () => {
    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ['my-tickets'],
        queryFn: fetchMyTickets,
    });

    if (isLoading) {
        return <div className="text-center py-10 text-slate-500">Loading your tickets...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">My Tickets</h1>
                <Link
                    to="/client/create"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                    Create New Ticket
                </Link>
            </div>

            <div className="grid gap-4">
                {tickets.map((ticket: any) => (
                    <Link
                        key={ticket.id}
                        to={`/client/tickets/${ticket.id}`}
                        className="block bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center space-x-3 mb-2">
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]
                                            }`}
                                    >
                                        {ticket.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-slate-500">#{ticket.id}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">{ticket.title}</h3>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center text-sm text-slate-500 mb-1">
                                    <Clock className="w-4 h-4 mr-1" />
                                    {new Date(ticket.updatedAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};
