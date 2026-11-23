import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { RequestTypeTag } from '@/features/ticket-board/components/request-flow/RequestTypeTag';
import type { RequestKind } from '@/features/ticket-board/components/request-flow/requestKind';

export interface ApprovalRow {
    ticketId: string;
    ticketNumber: string;
    title: string;
    requesterName: string;
    requestKind: RequestKind;
    flowPhaseLabel: string;
}

export const APPROVALS_QUERY_KEY = ['request-flow', 'approvals'] as const;

/** Requests waiting for the signed-in person's signature (the manager or GM named on them). */
export function useApprovals() {
    return useQuery<ApprovalRow[]>({
        queryKey: APPROVALS_QUERY_KEY,
        queryFn: async () => ((await api.get('/request-flow/approvals')).data ?? []) as ApprovalRow[],
        staleTime: 30_000,
    });
}

export function ApprovalsPage() {
    const { data, isLoading, isError } = useApprovals();
    return (
        <div className="ct-page">
            <header className="ct-catalog-head"><div className="min-w-0"><h1>Persetujuan</h1><p>Permintaan yang menunggu tanda tangan Anda</p></div></header>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat daftar persetujuan. Muat ulang halaman.</p>}
            {data && data.length === 0 && <p className="req-basket__empty">Tidak ada permintaan yang menunggu tanda tangan Anda.</p>}
            <ul className="req-approvals">
                {(data ?? []).map((row) => (
                    <li key={row.ticketId}>
                        <Link to={`/tickets/${row.ticketId}`} className="req-approvals__row">
                            <span className="req-approvals__main">
                                <RequestTypeTag kind={row.requestKind} />
                                <b>{row.title}</b>
                                <small>#{row.ticketNumber}</small>
                            </span>
                            <span className="req-approvals__who">{row.requesterName}</span>
                            <span className="req-turn req-turn--mine">Menunggu tanda tangan Anda</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
