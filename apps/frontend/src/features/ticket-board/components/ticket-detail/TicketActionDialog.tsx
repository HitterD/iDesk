import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal } from '@/components/ui/dialog';
import './ticket-actions.css';

interface TicketActionDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    busy?: boolean;
    children: React.ReactNode;
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

/** Ticket-only modal shell: trapped focus, restored trigger, and a reachable mobile footer. */
export function TicketActionDialog({ open, onClose, title, busy = false, children, onEscapeKeyDown }: TicketActionDialogProps) {
    const triggerRef = React.useRef<HTMLElement | null>(null);
    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}>
            <DialogPortal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
                <DialogPrimitive.Content
                    className="ticket-action-dialog"
                    aria-describedby={undefined}
                    onOpenAutoFocus={() => { triggerRef.current = document.activeElement as HTMLElement; }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        triggerRef.current?.focus();
                    }}
                    onEscapeKeyDown={(event) => {
                        onEscapeKeyDown?.(event);
                        if (busy) event.preventDefault();
                    }}
                    onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                    {children}
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}
