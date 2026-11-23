import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { RequestTypeTag } from '@/features/ticket-board/components/request-flow/RequestTypeTag';
import type { CatalogEntry } from '@/features/ticket-board/components/request-flow/picker/basket';
import type { RequestTicketType } from '../create-ticket/createTicketConfig';
import { EformRequestForm, type RenewSource } from './EformRequestForm';
import { HardwareRequestForm } from './HardwareRequestForm';
import type { EformKind } from './eformRules';

interface RequestFormScreenProps {
    type: RequestTicketType;
    onBack: () => void;
    /** Ticket id of the access being renewed (`?renewFrom=`). */
    renewFrom: string | null;
}

const COPY = {
    hardware: { kind: 'HARDWARE' as const, title: 'Hardware Request', sub: 'Ajukan perangkat baru, upgrade, penggantian aset, atau penjadwalan pemasangan.' },
    eform: { kind: 'EFORM' as const, title: 'E-Form Request', sub: 'Minta akses VPN, website, network, email, flashdisk, atau folder NAS dengan form bertanda tangan.' },
};

const wibToday = (): string => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** The create screen of a Hardware or E-Form request: header, the right form, and where the new ticket opens. */
export function RequestFormScreen({ type, onBack, renewFrom }: RequestFormScreenProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const copy = COPY[type];

    // The profile carries the department name (the auth store only has its id).
    const profile = useQuery<{ department?: { name?: string } } | null>({
        queryKey: ['request-form', 'profile'],
        queryFn: async () => { try { return (await api.get('/users/me')).data; } catch { return null; } },
        staleTime: 60_000,
    });
    const department = profile.data?.department?.name ?? '';

    const catalog = useQuery<CatalogEntry[]>({
        queryKey: ['request-form', 'catalog'],
        enabled: type === 'hardware',
        queryFn: async () => ((await api.get('/hardware-requests/catalog')).data?.data ?? []) as CatalogEntry[],
        staleTime: 5 * 60_000,
    });
    const renew = useQuery<RenewSource | null>({
        queryKey: ['request-form', 'renew', renewFrom],
        enabled: type === 'eform' && Boolean(renewFrom),
        queryFn: async () => {
            const flow = (await api.get(`/request-flow/${renewFrom}`)).data;
            const eform = flow?.eform;
            if (!eform) return null;
            return { kind: eform.formType as EformKind, to: eform.endDate ?? '', need: eform.fields?.kebutuhanAkses === 'Remote PC Kantor' ? 'REMOTE' : 'NETWORK', reason: eform.fields?.alasan ?? '' };
        },
    });

    if (!user) return null;
    const waiting = (type === 'hardware' && catalog.isLoading) || (type === 'eform' && Boolean(renewFrom) && renew.isLoading);

    const create = async (payload: Record<string, unknown>) => {
        try {
            const created = (await api.post(`/request-flow/${type}`, payload)).data as { ticketId: string; ticketNumber: string };
            toast.success(`Tiket ${created.ticketNumber} dibuat`);
            navigate(`${user.role === 'USER' ? '/client' : ''}/tickets/${created.ticketId}`);
        } catch (err) {
            throw new Error(getApiErrorMessage(err, 'Gagal mengirim permintaan. Coba lagi.'));
        }
    };

    return (
        <div className="ct-page ct-page-form">
            <header className="ct-catalog-head">
                <button type="button" onClick={onBack} aria-label="Kembali" className="ct-back"><ArrowLeft aria-hidden="true" /></button>
                <div className="min-w-0">
                    <h1>{copy.title} <RequestTypeTag kind={copy.kind} size="lg" /></h1>
                    <p>{copy.sub}</p>
                </div>
            </header>
            {waiting ? <p aria-busy="true">Memuat…</p> : type === 'hardware' ? (
                <HardwareRequestForm userId={user.id} userName={user.fullName} userDepartment={department} catalog={catalog.data ?? []} onSubmit={create} onCancel={onBack} />
            ) : (
                <EformRequestForm userId={user.id} userName={user.fullName} userDepartment={department} today={wibToday()} renew={renew.data ?? undefined} onSubmit={create} onCancel={onBack} />
            )}
        </div>
    );
}
