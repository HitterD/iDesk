/**
 * MessageActionMenu Component
 * 
 * Dropdown menu for message actions like edit, delete, copy.
 * Phase 4 polish feature.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Copy, Pencil, Trash2, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MessageActionMenuProps {
    messageId: string;
    messageContent: string;
    isOwn: boolean;
    isInternal: boolean;
    onEdit?: (messageId: string, content: string) => void;
    onDelete?: (messageId: string) => void;
    onReply?: (content: string) => void;
    className?: string;
}

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
    messageId,
    messageContent,
    isOwn,
    isInternal,
    onEdit,
    onDelete,
    onReply,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(messageContent);
            toast.success('Copied to clipboard');
        } catch (err) {
            toast.error('Failed to copy');
        }
        setIsOpen(false);
    };

    const handleEdit = () => {
        if (onEdit) {
            onEdit(messageId, messageContent);
        } else {
            toast.info('Edit feature coming soon');
        }
        setIsOpen(false);
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(messageId);
        } else {
            toast.info('Delete feature coming soon');
        }
        setIsOpen(false);
    };

    const handleReply = () => {
        if (onReply) {
            onReply(messageContent);
        }
        setIsOpen(false);
    };

    return (
        <div ref={menuRef} className={cn("relative", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
                title="More actions"
            >
                <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-fade-in">
                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <Copy className="w-4 h-4" />
                        Copy
                    </button>

                    {/* Reply */}
                    {onReply && (
                        <button
                            onClick={handleReply}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Reply className="w-4 h-4" />
                            Reply
                        </button>
                    )}

                    {/* Edit - only for own messages */}
                    {isOwn && (
                        <button
                            onClick={handleEdit}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            Edit
                        </button>
                    )}

                    {/* Delete - only for own messages or admins */}
                    {isOwn && (
                        <>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                            <button
                                onClick={handleDelete}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageActionMenu;
