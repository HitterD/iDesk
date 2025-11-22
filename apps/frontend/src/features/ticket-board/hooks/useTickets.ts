import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Mock Data
const initialTickets = [
    { id: 'TKT-001', title: 'Login Failure', priority: 'HIGH', status: 'TODO', assignee: 'Alice' },
    { id: 'TKT-002', title: 'Update CSS', priority: 'LOW', status: 'IN_PROGRESS', assignee: 'Bob' },
    { id: 'TKT-003', title: 'Database Migration', priority: 'MEDIUM', status: 'WAITING' },
];

// Mock API
const fetchTickets = async () => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return initialTickets;
};

const updateTicketStatusApi = async ({ id, status }: { id: string; status: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { id, status };
};

export const useTickets = () => {
    return useQuery({
        queryKey: ['tickets'],
        queryFn: fetchTickets,
        // Initial data to avoid loading state in this demo
        initialData: initialTickets,
    });
};

export const useUpdateTicketStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateTicketStatusApi,
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousTickets = queryClient.getQueryData(['tickets']);

            queryClient.setQueryData(['tickets'], (old: any[]) =>
                old.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket))
            );

            return { previousTickets };
        },
        onError: (_err, _newTodo, context: any) => {
            queryClient.setQueryData(['tickets'], context.previousTickets);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });
};
