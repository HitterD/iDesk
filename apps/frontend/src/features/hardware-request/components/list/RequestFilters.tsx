import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, LayoutGrid, List as ListIcon, RefreshCw, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ResSearch } from '@/components/resources/ResourceParts';
import type { ListFilters, RequestStatus, ItemCategory } from '../../types';
import { STATUS_BUB } from '../../utils/status.util';
import { cn } from '@/lib/utils';

const STATUSES: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT',
    'AWAITING_DELIVERY', 'INSTALLATION', 'AWAITING_USER_CONFIRMATION',
    'COMPLETED', 'REJECTED', 'CANCELLED',
];

const CATS: ItemCategory[] = ['LAPTOP', 'DESKTOP', 'MONITOR', 'ACCESSORY', 'NETWORK', 'SOFTWARE', 'OTHER'];
const SEARCH_DEBOUNCE_MS = 300;
const SCOPE_OPTIONS = [{ value: 'all' as const, label: 'Semua' }, { value: 'my' as const, label: 'Milik Saya' }];

interface RequestFiltersProps {
    value: ListFilters;
    onChange: (v: ListFilters) => void;
    scopeVisible: boolean;
    view?: 'table' | 'card';
    onViewChange?: (view: 'table' | 'card') => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

/** Shown value of a multi-select pop: "Semua", the single label, or "N dipilih". */
const popValue = (selected: readonly string[], labelOf: (v: string) => string) =>
    selected.length === 0 ? 'Semua' : selected.length === 1 ? labelOf(selected[0]) : `${selected.length} dipilih`;

interface MultiPopProps<V extends string> {
    k: string;
    options: readonly V[];
    selected: readonly V[];
    labelOf: (v: V) => string;
    colorOf?: (v: V) => string;
    onToggle: (v: V) => void;
}

function MultiPop<V extends string>({ k, options, selected, labelOf, colorOf, onToggle }: MultiPopProps<V>) {
    const shown = popValue(selected, (v) => labelOf(v as V));
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" className="queue-pop" aria-label={`${k}: ${shown}`}>
                    <span className="queue-pop-k">{k}</span><span className="queue-pop-v">{shown}</span><ChevronDown aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" variant="compact" className="res-pop-menu" aria-label={`Filter ${k.toLowerCase()}`}>
                {options.map((o) => (
                    <DropdownMenuCheckboxItem key={o} checked={selected.includes(o)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onToggle(o)}>
                        {colorOf && <span className="res-dot mr-2" style={{ background: colorOf(o) }} aria-hidden="true" />}
                        {labelOf(o)}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Mockup hardware.html `.filters`: search field, Status pop, refresh icon (+ production scope, category, view). */
export function RequestFilters({ value, onChange, scopeVisible, view = 'table', onViewChange, onRefresh, isRefreshing }: RequestFiltersProps) {
    const [searchTerm, setSearchTerm] = useState(value.search ?? '');

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        const timer = setTimeout(() => {
            if ((valueRef.current.search ?? '') !== searchTerm) {
                onChangeRef.current({ ...valueRef.current, search: searchTerm || undefined, page: 1 });
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const toggle = useCallback((key: 'status' | 'category', v: string) => {
        const set = new Set<string>((valueRef.current[key] as string[] | undefined) ?? []);
        if (set.has(v)) set.delete(v); else set.add(v);
        onChangeRef.current({ ...valueRef.current, [key]: Array.from(set), page: 1 });
    }, []);

    const clearAll = useCallback(() => {
        onChangeRef.current({ ...valueRef.current, status: [], category: [], search: undefined, page: 1 });
        setSearchTerm('');
    }, []);

    const hasFilters = (value.status?.length ?? 0) > 0 || (value.category?.length ?? 0) > 0 || !!value.search;

    return (
        <div className="res-filters" role="search" aria-label="Cari dan filter hardware request">
            <ResSearch id="hw-search" value={searchTerm} onChange={setSearchTerm}
                placeholder="Cari nomor request, pemohon, atau justifikasi..." label="Cari hardware request" />
            {scopeVisible && (
                <SegmentedControl aria-label="Cakupan request" className="dash-seg" options={SCOPE_OPTIONS}
                    value={value.scope ?? 'all'} onValueChange={(s) => onChangeRef.current({ ...valueRef.current, scope: s, page: 1 })} />
            )}
            <MultiPop k="Status" options={STATUSES} selected={value.status ?? []} labelOf={(s) => STATUS_BUB[s].label}
                colorOf={(s) => STATUS_BUB[s].color} onToggle={(s) => toggle('status', s)} />
            <MultiPop k="Kategori" options={CATS} selected={value.category ?? []} labelOf={(c) => c} onToggle={(c) => toggle('category', c)} />
            {hasFilters && (
                <button type="button" className="res-reset" onClick={clearAll} title="Reset semua filter"><X aria-hidden="true" />Reset</button>
            )}
            {onViewChange && (
                <span className="hidden md:inline-flex gap-1">
                    <button type="button" className={cn('queue-pop queue-pop-icon', view === 'table' && 'zm-mine is-on')} onClick={() => onViewChange('table')}
                        aria-label="Tampilan tabel" aria-pressed={view === 'table'} title="Tampilan Tabel"><ListIcon aria-hidden="true" /></button>
                    <button type="button" className={cn('queue-pop queue-pop-icon', view === 'card' && 'zm-mine is-on')} onClick={() => onViewChange('card')}
                        aria-label="Tampilan grid card" aria-pressed={view === 'card'} title="Tampilan Grid Card"><LayoutGrid aria-hidden="true" /></button>
                </span>
            )}
            {onRefresh && (
                <button type="button" className="queue-pop queue-pop-icon" onClick={onRefresh} aria-label="Segarkan data" title="Segarkan data" aria-busy={isRefreshing || undefined}>
                    <RefreshCw className={cn(isRefreshing && 'animate-spin')} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
