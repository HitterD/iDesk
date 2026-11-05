import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Monitor, Network } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils/dateFormat';
import { InfoRow } from './SidebarCard';

interface RecentDevice {
    hostname: string;
    lanIp: string | null;
    osVersion: string | null;
    lastSeenAt: string;
}

export interface RequesterDevice {
    requesterIp: string | null;
    requesterHostname: string | null;
    requesterHostnameSource: 'AGENT' | 'RDNS' | null;
    recentDevices: RecentDevice[];
}

const SOURCE_LABEL: Record<'AGENT' | 'RDNS', string> = {
    AGENT: 'Dilaporkan aplikasi desktop saat tiket dibuat',
    RDNS: 'Dari reverse DNS IP pemohon saat tiket dibuat',
};
const DEVICE_STALE_MS = 5 * 60_000;
const COPIED_RESET_MS = 1500;
const EMPTY = '—';

const useRequesterDevice = (ticketId: string) => useQuery({
    queryKey: ['ticket', ticketId, 'requester-device'],
    queryFn: async () => (await api.get<RequesterDevice>(`/tickets/${ticketId}/requester-device`, { skipToast: true })).data,
    staleTime: DEVICE_STALE_MS,
    retry: false,
});

function CopyValue({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_RESET_MS);
        } catch {
            toast.error('Gagal menyalin');
        }
    };
    return (
        <button type="button" onClick={copy} className="inline-flex max-w-full items-center gap-1 font-mono text-[12px] hover:text-primary"
            title={`Salin ${label}`} aria-label={`Salin ${label} ${value}`}>
            <span className="truncate">{value}</span>
            {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" /> : <Copy className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />}
        </button>
    );
}

const devicesTooltip = (devices: RecentDevice[]) => devices.length === 0 ? undefined
    : ['Perangkat lain pemohon:', ...devices.map((d) =>
        `• ${d.hostname}${d.lanIp ? ` (${d.lanIp})` : ''}${d.osVersion ? ` · ${d.osVersion}` : ''} · ${formatRelativeTime(d.lastSeenAt)}`)].join('\n');

/**
 * Computer and IP the requester reported this ticket from. Ticket handlers only: the endpoint refuses
 * everyone else, and the rows stay hidden when it does or when nothing was recorded.
 */
export const RequesterDeviceRows: React.FC<{ ticketId: string }> = ({ ticketId }) => {
    const { data } = useRequesterDevice(ticketId);
    const recent = Array.isArray(data?.recentDevices) ? data.recentDevices : [];
    if (!data || (!data.requesterIp && !data.requesterHostname && recent.length === 0)) return null;

    const others = recent.filter((device) => device.hostname !== data.requesterHostname);
    const hostnameTitle = [data.requesterHostnameSource ? SOURCE_LABEL[data.requesterHostnameSource] : null, devicesTooltip(others)]
        .filter(Boolean).join('\n\n') || undefined;

    return (
        <div className="mt-2" data-testid="requester-device">
            <InfoRow icon={Monitor} label="Komputer">
                <span title={hostnameTitle}>
                    {data.requesterHostname ? <CopyValue value={data.requesterHostname} label="nama komputer" /> : EMPTY}
                </span>
            </InfoRow>
            <InfoRow icon={Network} label="IP">
                {data.requesterIp ? <CopyValue value={data.requesterIp} label="IP" /> : EMPTY}
            </InfoRow>
        </div>
    );
};
