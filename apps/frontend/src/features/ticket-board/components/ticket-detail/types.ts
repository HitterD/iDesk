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
    // Hardware Installation fields
    isHardwareInstallation?: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    hardwareType?: string;
    userAcknowledged?: boolean;
    user: {
        /** Present in the findOne payload via the `user` relation; drives the presence dot. */
        id?: string;
        fullName: string;
        email: string;
        department?: {
            name: string;
        };
        site?: {
            name: string;
            code?: string;
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
        isInternal?: boolean;
        attachments: string[];
        sender?: {
            id?: string;
            fullName: string;
        };
    }[];
}

export interface Agent {
    id: string;
    fullName: string;
}
