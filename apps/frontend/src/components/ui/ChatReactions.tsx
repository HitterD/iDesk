import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus, Reply, MoreHorizontal, Copy, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

// Common emoji reactions (labels are the accessible names; mockup ticket-chat.js REACTIONS)
export const EMOJI_REACTIONS = [
    { emoji: '👍', label: 'Setuju' },
    { emoji: '❤️', label: 'Suka' },
    { emoji: '😂', label: 'Tertawa' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Sedih' },
    { emoji: '🎉', label: 'Rayakan' },
    { emoji: '✅', label: 'Selesai' },
    { emoji: '👀', label: 'Sedang dilihat' },
] as const;

export interface Reaction {
    emoji: string;
    count: number;
    users: string[];
    hasReacted: boolean;
}

const reactionLabel = (emoji: string) => EMOJI_REACTIONS.find((r) => r.emoji === emoji)?.label ?? emoji;

interface MessageReactionsProps {
    reactions: Reaction[];
    onAddReaction: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    className?: string;
}

/** Pastel chips under a bubble (mockup `.reacts`); clicking toggles your reaction with a pop. */
export const MessageReactions: React.FC<MessageReactionsProps> = ({
    reactions,
    onAddReaction,
    onRemoveReaction,
    className,
}) => {
    const [popped, setPopped] = useState<string | null>(null);
    // Chips that appear after the first render (added from the picker) land with the same pop.
    const seen = useRef<Set<string> | null>(null);
    if (seen.current === null) seen.current = new Set(reactions.map((r) => r.emoji));
    const fresh = reactions.find((r) => !seen.current!.has(r.emoji))?.emoji;
    useEffect(() => {
        reactions.forEach((r) => seen.current!.add(r.emoji));
        const gone = [...seen.current!].filter((e) => !reactions.some((r) => r.emoji === e));
        gone.forEach((e) => seen.current!.delete(e));
    });
    if (reactions.length === 0) return null;

    const toggle = (reaction: Reaction) => {
        setPopped(reaction.emoji);
        if (reaction.hasReacted) onRemoveReaction(reaction.emoji);
        else onAddReaction(reaction.emoji);
    };

    return (
        <div className={cn('chat-reacts', className)} aria-label="Reaksi">
            {reactions.map((reaction) => (
                <button
                    key={reaction.emoji}
                    type="button"
                    onClick={() => toggle(reaction)}
                    onAnimationEnd={() => setPopped(null)}
                    aria-pressed={reaction.hasReacted}
                    aria-label={`${reactionLabel(reaction.emoji)} · ${reaction.count} · ${reaction.hasReacted ? 'hapus reaksi Anda' : 'tambah reaksi'}`}
                    title={reaction.users.length > 0 ? reaction.users.join(', ') : undefined}
                    className={cn('chat-react', reaction.hasReacted && 'is-on', (popped === reaction.emoji || fresh === reaction.emoji) && 'is-pop')}
                >
                    <span aria-hidden="true">{reaction.emoji}</span>
                    <b aria-hidden="true">{reaction.count}</b>
                </button>
            ))}
        </div>
    );
};

interface ReactionPickerProps {
    reactions: Reaction[];
    onAddReaction: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    /** Trigger rendered inside the message tool pill. */
    children: React.ReactElement;
    align?: 'start' | 'end';
}

/** 4-column reaction grid opened from the message toolbar (mockup `A.openPicker`, title "Tambah reaksi"). */
export const ReactionPicker: React.FC<ReactionPickerProps> = ({ reactions, onAddReaction, onRemoveReaction, children, align = 'start' }) => {
    const [open, setOpen] = useState(false);
    const mine = new Set(reactions.filter((r) => r.hasReacted).map((r) => r.emoji));
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent side="top" align={align} sideOffset={8} collisionPadding={12} aria-label="Tambah reaksi"
                className="w-auto rounded-2xl border p-1.5 shadow-xl">
                <p className="td-pop-title">Tambah reaksi</p>
                <div className="td-grid-pop" style={{ '--cols': 4 } as React.CSSProperties}>
                    {EMOJI_REACTIONS.map(({ emoji, label }) => (
                        <button
                            key={emoji}
                            type="button"
                            aria-label={label}
                            title={label}
                            aria-pressed={mine.has(emoji)}
                            className={cn(mine.has(emoji) && 'is-on')}
                            onClick={() => {
                                if (mine.has(emoji)) onRemoveReaction(emoji);
                                else onAddReaction(emoji);
                                setOpen(false);
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
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
