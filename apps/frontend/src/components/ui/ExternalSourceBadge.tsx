import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';

/**
 * Dot colours a connected app may pick (mirrors backend APP_COLORS). Green belongs to iPop and
 * violet is off-brand, so neither is offered; each maps to a `--src-*` token in index.css.
 */
export const APP_COLORS = ['blue', 'sky', 'teal', 'amber', 'orange', 'red', 'pink', 'slate'] as const;
export type AppColor = typeof APP_COLORS[number];
export type SourceColor = AppColor | 'ipop';

export interface TicketOrigin { label: string; title: string; color: SourceColor }

/** GET /integration-apps/sources: externalSource (upper-case client id) → name + colour. */
interface AppSource { source: string; name: string; color: AppColor | null }

const IPOP: TicketOrigin = { label: 'iPop', title: 'Tiket dibuat dari aplikasi iPop', color: 'ipop' };
const EMAIL: TicketOrigin = { label: 'Email', title: 'Tiket dibuat dari email', color: 'slate' };
/** Staff only: the endpoint is closed to requesters, who never see other apps' tickets anyway. */
const STAFF_ROLES = ['ADMIN', 'MANAGER', 'AGENT', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV'];
const SOURCES_STALE_MS = 10 * 60_000;

/** Stable colour for an app without one chosen: same client id, same dot, on every screen. */
export function colorForSource(source: string): AppColor {
    let hash = 0;
    for (const char of source.toUpperCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return APP_COLORS[hash % APP_COLORS.length];
}

/** Which app filed the ticket: iPop, email, or a connected app (source API, client id in externalSource). */
export function externalSourceOf(source?: string | null, externalSource?: string | null, apps: readonly AppSource[] = []): TicketOrigin | undefined {
    if (source === 'IPOP') return IPOP;
    if (source === 'EMAIL') return EMAIL;
    if (source !== 'API' || !externalSource) return undefined;
    const app = apps.find((a) => a.source === externalSource.toUpperCase());
    const label = app?.name ?? externalSource;
    return { label, title: `Tiket dibuat dari aplikasi ${label} lewat API`, color: app?.color ?? colorForSource(externalSource) };
}

/** Names and colours of connected apps; cached, so every badge on a page shares one request. */
export function useAppSources(enabled: boolean): readonly AppSource[] {
    const { user } = useAuth();
    const { data } = useQuery({
        queryKey: ['integration-apps', 'sources'],
        queryFn: async () => (await api.get<AppSource[]>('/integration-apps/sources')).data,
        enabled: enabled && STAFF_ROLES.includes(user?.role ?? ''),
        staleTime: SOURCES_STALE_MS,
    });
    return Array.isArray(data) ? data : [];
}

const SourceChip: React.FC<{ origin: TicketOrigin; className?: string }> = ({ origin, className }) => (
    <span className={cn('src-badge', className)} data-src={origin.color} title={origin.title}>
        <i aria-hidden="true" />
        {origin.label}
    </span>
);

/** Connected app: looks up its display name and colour (one cached request per page). */
const AppSourceChip: React.FC<{ externalSource: string; className?: string }> = ({ externalSource, className }) => {
    const apps = useAppSources(true);
    const origin = externalSourceOf('API', externalSource, apps);
    return origin ? <SourceChip origin={origin} className={className} /> : null;
};

/** Neutral chip with the app's dot ("● iPop", "● E-BBK"); nothing for tickets created in iDesk itself. */
export const ExternalSourceBadge: React.FC<{ source?: string | null; externalSource?: string | null; className?: string }> = ({ source, externalSource, className }) => {
    if (source === 'API' && externalSource) return <AppSourceChip externalSource={externalSource} className={className} />;
    const origin = externalSourceOf(source, externalSource);
    return origin ? <SourceChip origin={origin} className={className} /> : null;
};
