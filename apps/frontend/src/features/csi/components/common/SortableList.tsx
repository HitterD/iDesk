import { useState, type CSSProperties, type ReactNode } from 'react';
import {
    DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const POINTER_ACTIVATION_DISTANCE_PX = 6;
const DRAGGING_Z_INDEX = 10;
const INSTRUCTIONS = 'Tekan Spasi untuk mengangkat, tombol panah atas atau bawah untuk memindahkan, Spasi untuk menjatuhkan, Escape untuk membatalkan.';

export interface SortableListProps<T> {
    items: readonly T[];
    getId: (item: T) => string;
    /** Called once per drop with ALL ids in the new order. May be async: the new order shows until it settles. */
    onReorder: (ids: string[]) => unknown;
    renderItem: (item: T, handle: ReactNode) => ReactNode;
    disabled?: boolean;
    /** Singular noun for the handle's accessible name: "Ubah urutan {label}". */
    label: string;
    className?: string;
}

function DragHandle({ label, disabled, activator }: { label: string; disabled?: boolean; activator: Record<string, unknown> }) {
    return (
        <button type="button" {...activator} disabled={disabled} aria-label={`Ubah urutan ${label}`}
            className="inline-flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[hsl(var(--idesk-text-secondary))] hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40">
            <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
    );
}

function SortableRow({ id, label, disabled, reduced, children }: {
    id: string; label: string; disabled?: boolean; reduced: boolean; children: (handle: ReactNode) => ReactNode;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id, disabled, transition: reduced ? null : undefined,
    });
    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? DRAGGING_Z_INDEX : undefined,
    };
    const handle = <DragHandle label={label} disabled={disabled} activator={{ ref: setActivatorNodeRef, ...attributes, ...listeners }} />;
    return (
        <li ref={setNodeRef} style={style} data-sortable-id={id} className={cn('list-none', isDragging && 'opacity-90 shadow-lg')}>
            {children(handle)}
        </li>
    );
}

function applyOrder<T>(items: readonly T[], ids: readonly string[] | null, getId: (item: T) => string): T[] {
    if (!ids) return [...items];
    const byId = new Map(items.map((item) => [getId(item), item]));
    const ordered = ids.flatMap((id) => byId.has(id) ? [byId.get(id) as T] : []);
    const placed = new Set(ids);
    return [...ordered, ...items.filter((item) => !placed.has(getId(item)))];
}

export function SortableList<T>({ items, getId, onReorder, renderItem, disabled, label, className }: SortableListProps<T>) {
    const reduced = Boolean(useReducedMotion());
    const [pending, setPending] = useState<string[] | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: POINTER_ACTIVATION_DISTANCE_PX } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const shown = applyOrder(items, pending, getId);
    const ids = shown.map(getId);
    const position = (id: unknown) => ids.indexOf(String(id)) + 1;
    const announcements: Announcements = {
        onDragStart: () => `${label} diangkat`,
        onDragOver: ({ over }) => over ? `${label} dipindah ke posisi ${position(over.id)} dari ${ids.length}` : undefined,
        onDragEnd: ({ over }) => over ? `${label} dijatuhkan di posisi ${position(over.id)} dari ${ids.length}` : `${label} dijatuhkan`,
        onDragCancel: () => 'Pemindahan dibatalkan',
    };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        const from = ids.indexOf(String(active.id));
        const to = over ? ids.indexOf(String(over.id)) : -1;
        if (from < 0 || to < 0 || from === to) return;
        const next = arrayMove(ids, from, to);
        setPending(next);
        try {
            await onReorder(next);
        } catch {
            // The caller reports the failure; the list just rolls back to the saved order.
        } finally {
            setPending(null);
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
            accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
                <ul className={cn('m-0 grid list-none gap-3 p-0', className)}>
                    {shown.map((item) => (
                        <SortableRow key={getId(item)} id={getId(item)} label={label} disabled={disabled} reduced={reduced}>
                            {(handle) => renderItem(item, handle)}
                        </SortableRow>
                    ))}
                </ul>
            </SortableContext>
        </DndContext>
    );
}
