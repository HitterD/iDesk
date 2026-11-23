import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';

type LegacyKind = 'hardware' | 'eform';

/** Where a request ticket opens for this person: requesters in the client portal, everyone else in the staff app. */
const ticketPath = (role: string, ticketId: string): string => (role === 'USER' ? `/client/tickets/${ticketId}` : `/tickets/${ticketId}`);
const homeOf = (role: string): string => (role === 'USER' ? '/client/my-tickets' : '/tickets/list');
/** Old hardware sub-pages (calendar, dashboard, catalog, new) now live in "Perangkat & Akses" for IT. */
const subPageHomeOf = (kind: LegacyKind, role: string): string =>
    (kind === 'hardware' && STAFF_DEVICE_ROLES.includes(role) ? '/devices-access' : homeOf(role));
const STAFF_DEVICE_ROLES: readonly string[] = ['ADMIN', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Old Hardware Request / E-Form pages (emails, notifications, bookmarks) named the old request id. The request is a
 * ticket now: ask the server which one, and go there. An id that is not found goes home with a message.
 */
export function LegacyRequestRedirect({ kind }: { kind: LegacyKind }) {
    const { user, isAuthenticated } = useAuth();
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const [target, setTarget] = useState<string | null>(null);
    const asked = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !user || asked.current) return;
        asked.current = true;
        if (!id || !UUID.test(id)) { setTarget(subPageHomeOf(kind, user.role)); return; }
        api.get(`/request-flow/by-legacy/${kind}/${id}`)
            .then((res) => setTarget(ticketPath(user.role, (res.data as { ticketId: string }).ticketId)))
            .catch(() => { toast.error('Permintaan tidak ditemukan'); setTarget(homeOf(user.role)); });
    }, [isAuthenticated, user, kind, id]);

    if (!isAuthenticated || !user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
    return target ? <Navigate to={target} replace /> : <p aria-busy="true">Membuka permintaan…</p>;
}
