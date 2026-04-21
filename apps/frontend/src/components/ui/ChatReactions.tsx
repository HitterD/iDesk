import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus, Reply, MoreHorizontal, Copy, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Common emoji reactions
const EMOJI_REACTIONS = [
    { emoji: '👍', label: 'Thumbs up' },
    { emoji: '❤️', label: 'Heart' },
    { emoji: '😂', label: 'Laugh' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '🎉', label: 'Celebrate' },
    { emoji: '✅', label: 'Done' },
    { emoji: '👀', label: 'Looking' },
];

interface Reaction {
    emoji: string;
    count: number;
    users: string[];
    hasReacted: boolean;
}

interface MessageReactionsProps {
    reactions: Reaction[];
    onAddReaction: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    className?: string;
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({
    reactions,
    onAddReaction,
    onRemoveReaction,
    className,
}) => {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleReactionClick = (emoji: string, hasReacted: boolean) => {
        if (hasReacted) {
            onRemoveReaction(emoji);
        } else {
            onAddReaction(emoji);
        }
    };

    return (
        <div className={cn('flex items-center gap-1 flex-wrap', className)}>
            {/* Existing reactions */}
            {reactions.map((reaction) => (
                <button
                    key={reaction.emoji}
                    onClick={() => handleReactionClick(reaction.emoji, reaction.hasReacted)}
                    className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors duration-150',
                        'hover:scale-105 active:scale-95',
                        reaction.hasReacted
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent'
                    )}
                    title={reaction.users.join(', ')}
                >
                    <span>{reaction.emoji}</span>
                    <span className="font-medium">{reaction.count}</span>
                </button>
            ))}

            {/* Add reaction button */}
            <div className="relative" ref={pickerRef}>
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    <SmilePlus className="w-3.5 h-3.5" />
                </button>

                {/* Emoji picker */}
                <AnimatePresence>
                    {showPicker && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 4 }}
                            className="absolute bottom-full mb-1 left-0 z-50 p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex gap-0.5">
                                {EMOJI_REACTIONS.map(({ emoji, label }) => (
                                    <button
                                        key={emoji}
                                        onClick={() => {
                                            onAddReaction(emoji);
                                            setShowPicker(false);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        title={label}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

// Quick actions that appear on message hover
interface MessageActionsProps {
    onReply?: () => void;
    onReact?: () => void;
    onCopy?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isOwn?: boolean;
    className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
    onReply,
    onReact,
    onCopy,
    onEdit,
    onDelete,
    isOwn = false,
    className,
}) => {
    const [showMore, setShowMore] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setShowMore(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
                'flex items-center gap-0.5 p-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600',
                className
            )}
        >
            {onReact && (
                <button
                    onClick={onReact}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                    title="Add reaction"
                >
                    <SmilePlus className="w-4 h-4 text-slate-400" />
                </button>
            )}
            
            {onReply && (
                <button
                    onClick={onReply}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                    title="Reply"
                >
                    <Reply className="w-4 h-4 text-slate-400" />
                </button>
            )}

            <div className="relative" ref={moreRef}>
                <button
                    onClick={() => setShowMore(!showMore)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                    title="More options"
                >
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                </button>

                <AnimatePresence>
                    {showMore && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 z-50 py-1 min-w-[140px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700"
                        >
                            {onCopy && (
                                <button
                                    onClick={() => {
                                        onCopy();
                                        setShowMore(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copy text
                                </button>
                            )}
                            
                            {isOwn && onEdit && (
                                <button
                                    onClick={() => {
                                        onEdit();
                                        setShowMore(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                </button>
                            )}
                            
                            {isOwn && onDelete && (
                                <button
                                    onClick={() => {
                                        onDelete();
                                        setShowMore(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// Thread indicator for messages with replies
interface ThreadIndicatorProps {
    replyCount: number;
    lastReplyAt: string;
    participants: Array<{ fullName: string; avatarUrl?: string }>;
    onClick: () => void;
    className?: string;
}

export const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({
    replyCount,
    lastReplyAt,
    participants,
    onClick,
    className,
}) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 px-3 py-1.5 mt-2 rounded-lg',
                'text-primary hover:bg-primary/5 transition-colors',
                'border border-primary/20',
                className
            )}
        >
            {/* Participant avatars */}
            <div className="flex -space-x-2">
                {participants.slice(0, 3).map((user, i) => (
                    <div
                        key={i}
                        className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[8px] font-bold text-white border-2 border-white dark:border-slate-800"
                    >
                        {user.fullName.charAt(0)}
                    </div>
                ))}
            </div>
            
            <span className="text-xs font-medium">
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </span>
            
            <span className="text-xs text-slate-400">
                Last reply {new Date(lastReplyAt).toLocaleDateString()}
            </span>
        </button>
    );
};

export default MessageReactions;
