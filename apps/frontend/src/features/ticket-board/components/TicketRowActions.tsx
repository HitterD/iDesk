import React from 'react';
import { ArrowUpRight, CircleCheck, Copy, Ellipsis, Eye, ListChecks, MonitorSmartphone, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Actions a queue row/card already supports; every entry is optional so callers keep their permissions. */
export interface TicketRowActionHandlers {
    onOpen: () => void;
    /** Quick resolve (opens the existing resolve dialog). Omit when the ticket cannot be resolved here. */
    onResolve?: () => void;
    /** Existing quick preview panel (Kanban). */
    onPreview?: () => void;
    /** Linked Hardware Request. */
    onOpenHardware?: () => void;
    /** Opens the existing PIC picker (reassign keeps its confirmation). */
    onChangePic?: () => void;
    /** Row selection for bulk actions. */
    selection?: { selected: boolean; onToggle: () => void };
}

interface TicketRowActionsProps extends TicketRowActionHandlers {
    /** Display number, e.g. "190826-GEN-0005". */
    number: string;
    /** `row`: hover/focus quick actions at the end of the title cell. `card`: ⋯ only (mobile card / Kanban). */
    layout: 'row' | 'card';
    className?: string;
}

/** Clicks and keys inside the menu (portalled, but React-bubbled) must never reach the row/card. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

const copyNumber = (number: string) => {
    navigator.clipboard?.writeText(`#${number}`)
        .then(() => toast.success(`Nomor tiket #${number} disalin`))
        .catch(() => toast.error('Gagal menyalin nomor tiket'));
};

/**
 * Mockup `queue-actions.js`: "Tandai selesai" + ⋯ fade in on hover/focus and float over the end of the
 * title cell only (never over PIC/SLA). Touch devices always show ⋯; quick resolve lives in the menu there.
 */
export function TicketRowActions({ number, layout, className, onOpen, onResolve, onPreview, onOpenHardware, onChangePic, selection }: TicketRowActionsProps) {
    const [open, setOpen] = React.useState(false);
    // A menu item that opens another overlay must not hand focus back to the ⋯ trigger first.
    const keepFocus = React.useRef(false);
    const handOff = (action: () => void) => () => {
        keepFocus.current = true;
        requestAnimationFrame(action);
    };

    return (
        <div
            className={cn(layout === 'row' ? 'queue-row-acts' : 'queue-card-acts', open && 'is-open', className)}
            onClick={stop}
            onKeyDown={stop}
            onPointerDown={stop}
        >
            {layout === 'row' && onResolve && (
                <button type="button" className="queue-act-btn is-ok" onClick={onResolve}
                    aria-label={`Tandai selesai #${number}`} title="Tandai selesai">
                    <CircleCheck aria-hidden="true" />
                </button>
            )}
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="queue-act-btn" aria-label={`Aksi lainnya #${number}`} title="Aksi lainnya">
                        <Ellipsis aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    variant="compact"
                    aria-label={`Aksi #${number}`}
                    onCloseAutoFocus={(event) => {
                        if (keepFocus.current) event.preventDefault();
                        keepFocus.current = false;
                    }}
                >
                    <DropdownMenuItem onSelect={onOpen}><ArrowUpRight />Buka tiket</DropdownMenuItem>
                    {onPreview && <DropdownMenuItem onSelect={handOff(onPreview)}><Eye />Pratinjau cepat</DropdownMenuItem>}
                    {onResolve && <DropdownMenuItem onSelect={handOff(onResolve)}><CircleCheck />Tandai selesai</DropdownMenuItem>}
                    {onOpenHardware && <DropdownMenuItem onSelect={onOpenHardware}><MonitorSmartphone />Buka Hardware Request</DropdownMenuItem>}
                    {onChangePic && <DropdownMenuItem onSelect={handOff(onChangePic)}><UserRoundPlus />Ganti PIC</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => copyNumber(number)}><Copy />Salin nomor tiket</DropdownMenuItem>
                    {selection && (
                        <DropdownMenuItem onSelect={selection.onToggle}>
                            <ListChecks />{selection.selected ? 'Batal pilih' : 'Pilih untuk aksi massal'}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
