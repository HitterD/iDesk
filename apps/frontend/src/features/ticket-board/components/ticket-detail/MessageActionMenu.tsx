/**
 * MessageActionMenu: the ⋯ of the message tool pill (mockup ticket-chat.js `bindMore`).
 * Salin · Balas · Edit · Hapus (destructive). Edit and Hapus appear only when the caller
 * passes a handler, i.e. when that action is actually allowed for this message.
 */

import React, { useRef } from 'react';
import { Copy, Ellipsis, Pencil, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageActionMenuProps {
    messageId: string;
    messageContent: string;
    isOwn: boolean;
    isInternal: boolean;
    /** Stickers have no text to copy or edit. */
    isSticker?: boolean;
    onEdit?: (messageId: string, content: string) => void;
    onDelete?: (messageId: string) => void;
    onReply?: (content: string) => void;
    align?: 'start' | 'end';
}

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
    messageId,
    messageContent,
    isOwn,
    isSticker = false,
    onEdit,
    onDelete,
    onReply,
    align = 'start',
}) => {
    // Edit and Balas hand the focus to the composer; the menu must not pull it back to ⋯ on close.
    const focusMovesAway = useRef(false);
    const handOff = (action: () => void) => () => {
        focusMovesAway.current = true;
        action();
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(messageContent);
            toast.success('Pesan disalin ke clipboard');
        } catch {
            toast.error('Gagal menyalin pesan');
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Aksi lainnya" title="Aksi lainnya">
                    <Ellipsis aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={align}
                variant="compact"
                aria-label="Aksi pesan"
                onCloseAutoFocus={(event) => {
                    if (!focusMovesAway.current) return;
                    focusMovesAway.current = false;
                    event.preventDefault();
                }}
            >
                <DropdownMenuItem onSelect={handleCopy} disabled={isSticker}><Copy />Salin</DropdownMenuItem>
                {onReply && <DropdownMenuItem onSelect={handOff(() => onReply(messageContent))}><Reply />Balas</DropdownMenuItem>}
                {onEdit && isOwn && !isSticker && (
                    <DropdownMenuItem onSelect={handOff(() => onEdit(messageId, messageContent))}><Pencil />Edit</DropdownMenuItem>
                )}
                {onDelete && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(messageId)}><Trash2 />Hapus</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default MessageActionMenu;
