export interface IChatPlatformAdapter {
    sendMessage(to: string, content: string): Promise<void>;
}
