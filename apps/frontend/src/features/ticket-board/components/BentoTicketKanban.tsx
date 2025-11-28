import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
    MessageSquare, 
    Clock, 
    AlertTriangle, 
    Tag, 
    UserCheck,
    LayoutGrid, 
    List,
    Inbox,
    CircleDot,
    Hourglass,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    category?: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isOverdue?: boolean;
    assignedTo?: { id: string; fullName: string; };
    user?: { fullName: string; department?: { name: string }; };
    messages?: any[];
    createdAt: string;
}

const PRIORITY_CONFIG = {
    LOW: { color: 'bg-slate-400', border: 'border-l-slate-400' },
    MEDIUM: { color: 'bg-yellow-500', border: 'border-l-yellow-500' },
    HIGH: { color: 'bg-orange-500', border: 'border-l-orange-500' },
    CRITICAL: { color: 'bg-red-500 animate-pulse', border: 'border-l-red-500' },
};

const COLUMNS = [
    { id: 'TODO', title: 'Open', color: 'bg-slate-500', icon: Inbox },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-500', icon: CircleDot },
    { id: 'WAITING_VENDOR', title: 'Waiting Vendor', color: 'bg-orange-500', icon: Hourglass },
    { id: 'RESOLVED', title: 'Resolved', color: 'bg-green-500', icon: CheckCircle2 },
];

const TicketCard = ({ ticket, index, onClick }: { ticket: Ticket; index: number; onClick: () => void }) => {
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    
    return (
        <Draggable draggableId={ticket.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    className={`bg-white dark:bg-slate-800 p-4 rounded-xl mb-3 border-l-4 ${priorityConfig.border} border border-slate-100 dark:border-slate-700 group hover:shadow-lg transition-all duration-200 cursor-pointer ${
                        snapshot.isDragging ? 'shadow-2xl rotate-2 scale-105 z-50' : ''
                    }`}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                            #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                        </span>
                        <div className="flex items-center gap-1">
                            {ticket.isOverdue && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                            <div className={`w-2 h-2 rounded-full ${priorityConfig.color}`}></div>
                        </div>
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {ticket.title}
                    </h4>

                    {/* Description */}
                    {ticket.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                            {ticket.description}
                        </p>
                    )}

                    {/* Category */}
                    {ticket.category && (
                        <div className="flex items-center gap-1 mb-3">
                            <Tag className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">{ticket.category}</span>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            {/* Requester */}
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {ticket.user?.fullName?.charAt(0) || '?'}
                            </div>
                            {/* Assignee */}
                            {ticket.assignedTo && (
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <UserCheck className="w-3 h-3" />
                                    <span className="truncate max-w-[60px]">{ticket.assignedTo.fullName.split(' ')[0]}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            {ticket.messages && ticket.messages.length > 0 && (
                                <span className="flex items-center gap-1 text-xs">
                                    <MessageSquare className="w-3 h-3" />
                                    {ticket.messages.length}
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-xs">
                                <Clock className="w-3 h-3" />
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

const Column = ({ column, tickets, onCardClick }: { column: typeof COLUMNS[0]; tickets: Ticket[]; onCardClick: (id: string) => void }) => {
    const Icon = column.icon;
    
    return (
        <div className="flex-1 min-w-[280px] max-w-[320px]">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${column.color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">{column.title}</h3>
                </div>
                <span className="bg-white dark:bg-slate-700 px-2.5 py-1 rounded-full text-xs font-bold text-slate-500 dark:text-slate-300 shadow-sm">
                    {tickets.length}
                </span>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl min-h-[calc(100vh-300px)] transition-all duration-200 ${
                            snapshot.isDraggingOver 
                                ? 'bg-primary/5 ring-2 ring-primary/30 ring-dashed' 
                                : ''
                        }`}
                    >
                        {tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                                <Inbox className="w-8 h-8 mb-2" />
                                <span className="text-xs">No tickets</span>
                            </div>
                        ) : (
                            tickets.map((ticket, index) => (
                                <TicketCard 
                                    key={ticket.id} 
                                    ticket={ticket} 
                                    index={index} 
                                    onClick={() => onCardClick(ticket.id)}
                                />
                            ))
                        )}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

export const BentoTicketKanban = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
        queryKey: ['tickets'],
        queryFn: async () => {
            const res = await api.get('/tickets');
            return res.data;
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const res = await api.patch(`/tickets/${id}/status`, { status });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            toast.success('Ticket status updated');
        },
        onError: () => {
            toast.error('Failed to update ticket status');
        },
    });

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        // Update ticket status
        updateStatusMutation.mutate({
            id: draggableId,
            status: destination.droppableId,
        });
    };

    const handleCardClick = (ticketId: string) => {
        navigate(`/tickets/${ticketId}`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Ticket Board</h1>
                    <p className="text-slate-500 dark:text-slate-400">Drag and drop to update ticket status</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button
                            className="p-2 bg-primary/10 text-primary rounded-xl"
                            title="Kanban View"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/tickets/list')}
                            className="p-2 text-slate-400 hover:text-primary rounded-xl transition-colors"
                            title="List View"
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 mb-6 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Total:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{tickets.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-slate-500 dark:text-slate-400">Critical:</span>
                    <span className="font-bold text-red-500">{tickets.filter(t => t.priority === 'CRITICAL').length}</span>
                </div>
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-slate-500 dark:text-slate-400">Overdue:</span>
                    <span className="font-bold text-red-500">{tickets.filter(t => t.isOverdue).length}</span>
                </div>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-6 flex-1">
                    {COLUMNS.map((column) => (
                        <Column
                            key={column.id}
                            column={column}
                            tickets={tickets.filter((t) => t.status === column.id)}
                            onCardClick={handleCardClick}
                        />
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
};
