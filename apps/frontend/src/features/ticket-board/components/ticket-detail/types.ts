export interface TicketDetail {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    device?: string;
    createdAt: string;
    updatedAt: string;
    slaTarget?: string;
    user: {
        fullName: string;
        email: string;
        department?: {
            name: string;
        };
        telegramChatId?: string;
    };
    assignedTo?: {
        id: string;
        fullName: string;
    };
    messages?: {
        id: string;
        content: string;
        createdAt: string;
        isSystemMessage: boolean;
        attachments: string[];
        sender?: {
            fullName: string;
        };
    }[];
}

export interface Agent {
    id: string;
    fullName: string;
}
