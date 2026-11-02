import React from 'react';
import { Clock, PenLine, ShieldCheck, Database, CheckCircle2, Ban, FileEdit, Globe, Wifi, Usb, Mail, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/features/dashboard/dashboard.css';
import '@/components/resources/resources.css';

/** Roles allowed to process and fulfill ICT requests */
export const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT'] as const;

/** Roles that see every request of their site (all sites for ADMIN/MANAGER) to follow its progress. Mirrors backend EFORM_MONITOR_ROLES. */
export const EFORM_MONITOR_ROLES = [
    'ADMIN', 'MANAGER', 'AGENT_ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV',
] as const;

/** Default only: VPN needs the GM after the manager; ICT may switch it per request. Mirrors backend GM_DEFAULT_FORM_TYPES. */
export const needsGmSignature = (formType: string | undefined): boolean => formType === 'VPN';

/** Server-side lifecycle of an E-Form request. */
export enum EFormStatus {
    DRAFT = 'DRAFT',
    PENDING_MANAGER = 'PENDING_MANAGER',
    /** Manager approved; IT gets the GM's signature on the printed form and uploads it. */
    PENDING_GM = 'PENDING_GM',
    PENDING_ICT = 'PENDING_ICT',
    CONFIRMED = 'CONFIRMED',
    REJECTED = 'REJECTED',
    /** A proposal from a ticket the requester declined or IT withdrew before it was signed. */
    CANCELLED = 'CANCELLED',
}

/** Synology NAS account status mode */
export enum SynologyAccountStatus {
    NEW_ACCOUNT = 'NEW_ACCOUNT',
    EXISTING_ACCOUNT = 'EXISTING_ACCOUNT',
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
    [EFormStatus.PENDING_GM]: {
        label: 'Menunggu TTD GM',
        hint: 'Tim ICT meminta tanda tangan GM',
        icon: PenLine,
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
        hint: 'Kredensial / Akses sudah tersedia',
        icon: CheckCircle2,
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
        solid: 'bg-emerald-600',
    },
    [EFormStatus.CANCELLED]: {
        label: 'Dibatalkan',
        hint: 'Usulan tidak dilanjutkan',
        icon: Ban,
        badge: 'bg-muted text-muted-foreground border-border',
        solid: 'bg-muted-foreground/40',
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
    FLASHDISK: { label: 'Akses Flashdisk', description: 'Izin penggunaan USB / Flashdisk di PC kerja', icon: Usb },
    EMAIL: { label: 'Request Email', description: 'Pembuatan akun email dinas baru @kapalapi.co.id', icon: Mail },
    SYNOLOGY_NAS: { label: 'Synology NAS', description: 'Permintaan akses shared folder Synology NAS', icon: HardDrive },
};

export const getTypeConfig = (type: string): TypeConfig =>
    TYPE_CONFIG[type] ?? { label: type, description: 'Permintaan akses', icon: ShieldCheck };

export const EFORM_TYPES = (['VPN', 'WEBSITE', 'NETWORK', 'FLASHDISK', 'EMAIL', 'SYNOLOGY_NAS'] as const).map(id => ({
    id,
    ...TYPE_CONFIG[id],
}));

/** Mockup bubble hue per status (eform.html ST). */
const STATUS_BUB_HUE: Record<string, { c: string; ink?: string }> = {
    [EFormStatus.PENDING_MANAGER]: { c: 'var(--dash-orange, #f2930d)', ink: 'var(--dash-ink-orange, #a85d00)' },
    [EFormStatus.PENDING_GM]: { c: 'var(--dash-orange, #f2930d)', ink: 'var(--dash-ink-orange, #a85d00)' },
    [EFormStatus.PENDING_ICT]: { c: 'var(--dash-blue, #3d63b8)' },
    [EFormStatus.CONFIRMED]: { c: 'var(--dash-green, #2fb350)', ink: 'var(--dash-ink-green, #1c7a35)' },
    [EFormStatus.REJECTED]: { c: 'var(--dash-red, #f04438)', ink: 'var(--dash-ink-red, #c4281c)' },
    [EFormStatus.DRAFT]: { c: 'var(--dash-gray, #8e8e93)' },
};

/** Status pill (round-2 `.bub`). Colour here is the request's position in the flow, nothing else. */
export const EformStatusBadge: React.FC<{ status: string; className?: string }> = ({
    status,
    className,
}) => {
    const { label } = getStatusConfig(status);
    const hue = STATUS_BUB_HUE[status] ?? STATUS_BUB_HUE[EFormStatus.DRAFT];
    const style = { '--c': hue.c, ...(hue.ink ? { '--ink': hue.ink } : {}) } as React.CSSProperties;
    return (
        <span className={cn('dash-bub', className)} style={style}>
            <span className="res-dot" aria-hidden="true" />
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
