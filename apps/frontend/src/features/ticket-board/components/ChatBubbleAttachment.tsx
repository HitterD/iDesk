import React from 'react';

interface ChatBubbleAttachmentProps {
    attachments: string[];
    onImageClick: (url: string) => void;
}

export const ChatBubbleAttachment: React.FC<ChatBubbleAttachmentProps> = ({ attachments, onImageClick }) => {
    if (!attachments || attachments.length === 0) return null;

    return (
        <div className="grid grid-cols-2 gap-2 mt-2">
            {attachments.map((url, index) => (
                <img
                    key={index}
                    src={url}
                    alt="attachment"
                    className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-white/10"
                    onClick={() => onImageClick(url)}
                />
            ))}
        </div>
    );
};
