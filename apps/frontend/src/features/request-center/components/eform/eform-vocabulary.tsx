import React from 'react';
import { Clock, ShieldCheck, Database, CheckCircle2, Ban, FileEdit, Globe, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Server-side lifecycle of an E-Form request. */
export enum EFormStatus {
    DRAFT = 'DRAFT',
    PENDING_MANAGER = 'PENDING_MANAGER',
    PENDING_ICT = 'PENDING_ICT',
    CONFIRMED = 'CONFIRMED',
    REJECTED = 'REJECTED',
}

/**
 * Single source of truth for how an E-Form request is named and coloured.
 *
 * Colour is reserved for STATUS (where the request is in the approval flow) —
 * the one axis where a colour difference carries meaning. Access TYPE is
 * distinguished by icon and label only, so the two axes never compete.
 */

interface StatusConfig {
    /** Indonesian label shown to users. */
    label: string;
    /** What the user should expect next, one short clause. */
    hint: string;
    icon: React.ElementType;
    /** Badge surface — semantic tokens with an explicit dark counterpart. */
    badge: string;
    /** Solid fill for progress markers and rails. */
    solid: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
    [EFormStatus.DRAFT]: {
        label: 'Draf',
        hint: 'Belum dikirim',
        icon: FileEdit,
        badge: 'bg-muted text-muted-foreground border-border',
        solid: 'bg-muted-foreground/40',
    },
    [EFormStatus.PENDING_MANAGER]: {
        label: 'Menunggu Atasan',
        hint: 'Menunggu persetujuan atasan',
        icon: Clock,
        badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
        solid: 'bg-amber-500',
    },
    [EFormStatus.PENDING_ICT]: {
        label: 'Diproses ICT',
        hint: 'Tim ICT sedang menyiapkan akses',
        icon: Database,
        badge: 'bg-primary/10 text-primary border-primary/25',
        solid: 'bg-primary',
    },
    [EFormStatus.CONFIRMED]: {
        label: 'Akses Siap',
        hint: 'Kredensial sudah tersedia',
        icon: CheckCircle2,
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
        solid: 'bg-emerald-600',
    },
    [EFormStatus.REJECTED]: {
        label: 'Ditolak',
        hint: 'Permintaan tidak disetujui',
        icon: Ban,
        badge: 'bg-destructive/10 text-destructive border-destructive/25',
        solid: 'bg-destructive',
    },
};

export const getStatusConfig = (status: string): StatusConfig =>
    STATUS_CONFIG[status] ?? STATUS_CONFIG[EFormStatus.DRAFT];

interface TypeConfig {
    label: string;
    /** Sentence describing the access, used as page subtitle and card support text. */
    description: string;
    icon: React.ElementType;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
    VPN: { label: 'Akses VPN', description: 'Remote ke jaringan kantor', icon: ShieldCheck },
    WEBSITE: { label: 'Akses Website', description: 'Buka blokir website', icon: Globe },
    NETWORK: { label: 'Akses Jaringan', description: 'Akses jaringan khusus', icon: Wifi },
};

export const getTypeConfig = (type: string): TypeConfig =>
    TYPE_CONFIG[type] ?? { label: type, description: 'Permintaan akses', icon: ShieldCheck };

export const EFORM_TYPES = (['VPN', 'WEBSITE', 'NETWORK'] as const).map(id => ({
    id,
    ...TYPE_CONFIG[id],
}));

/** Status pill. Colour here is the request's position in the flow, nothing else. */
export const EformStatusBadge: React.FC<{ status: string; className?: string }> = ({
    status,
    className,
}) => {
    const { label, icon: Icon, badge } = getStatusConfig(status);
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                badge,
                className,
            )}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
};

/** Access-type pill. Neutral by design — the icon carries the distinction. */
export const EformTypeBadge: React.FC<{ type: string; className?: string }> = ({
    type,
    className,
}) => {
    const { label, icon: Icon } = getTypeConfig(type);
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground',
                className,
            )}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
};
