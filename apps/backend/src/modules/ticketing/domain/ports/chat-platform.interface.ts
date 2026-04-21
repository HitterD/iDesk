export interface InboundMessage {
    chatId: string;
    text: string;
    senderName: string;
    action?: string; // For callback queries
    messageId?: number; // For editing messages
}

export interface IChatPlatform {
    sendMessage(chatId: string, text: string, options?: any): Promise<void>;
    parseIncomingWebhook(payload: unknown): InboundMessage;
}
