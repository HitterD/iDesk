import React from 'react';

/**
 * Badge for message source. WEB shows nothing; legacy TELEGRAM messages are left unlabelled.
 */
export const MessageSourceBadge: React.FC<{ source?: string }> = ({ source }) => {
    if (source === 'EMAIL') {
        return (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                Email
            </span>
        );
    }

    return null;
};
