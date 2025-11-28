import React from 'react';
import { MessageCircle } from 'lucide-react';

interface TelegramBadgeProps {
    size?: 'sm' | 'md';
}

/**
 * Badge to indicate a message came from Telegram
 */
export const TelegramBadge: React.FC<TelegramBadgeProps> = ({ size = 'sm' }) => {
    const sizeClasses = size === 'sm' 
        ? 'text-[10px] px-1.5 py-0.5' 
        : 'text-xs px-2 py-1';
    
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

    return (
        <span 
            className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-blue-500/20 text-blue-400 font-medium`}
            title="Sent via Telegram"
        >
            <MessageCircle className={iconSize} />
            <span>Telegram</span>
        </span>
    );
};

/**
 * Badge for message source (WEB, TELEGRAM, EMAIL)
 */
export const MessageSourceBadge: React.FC<{ source?: string }> = ({ source }) => {
    if (!source || source === 'WEB') return null;

    if (source === 'TELEGRAM') {
        return <TelegramBadge size="sm" />;
    }

    if (source === 'EMAIL') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                Email
            </span>
        );
    }

    return null;
};

export default TelegramBadge;
