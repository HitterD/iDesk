import { useState } from 'react';
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
    /** Only on the history: when I signed. */
    signedAt?: string;
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

export const APPROVAL_HISTORY_QUERY_KEY = ['request-flow', 'approvals', 'history'] as const;
type ApprovalView = 'waiting' | 'done';
const signedOn = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });

export function ApprovalsPage() {
    const [view, setView] = useState<ApprovalView>('waiting');
    const waitingQuery = useApprovals();
    const history = useQuery<ApprovalRow[]>({
        queryKey: APPROVAL_HISTORY_QUERY_KEY,
        enabled: view === 'done',
        queryFn: async () => ((await api.get('/request-flow/approvals/history')).data ?? []) as ApprovalRow[],
        staleTime: 30_000,
    });
    const { data, isLoading, isError } = view === 'done' ? history : waitingQuery;
    const emptyText = view === 'done' ? 'Belum ada permintaan yang Anda tandatangani.' : 'Tidak ada permintaan yang menunggu tanda tangan Anda.';
    const [search, setSearch] = useState('');
    const [kind, setKind] = useState('');
    const term = search.trim().toLocaleLowerCase('id-ID');
    const rows = (data ?? []).filter((row) => (!kind || row.requestKind === kind)
        && `${row.title} ${row.ticketNumber} ${row.requesterName}`.toLocaleLowerCase('id-ID').includes(term));
    return (
        <div className="ct-page">
            <header className="ct-catalog-head"><div className="min-w-0"><h1>Persetujuan</h1><p>{view === 'done' ? 'Permintaan yang sudah Anda tandatangani' : 'Permintaan yang menunggu tanda tangan Anda'}</p></div></header>
            <div className="da-filters" role="group" aria-label="Tampilan persetujuan">
                <button type="button" className={`req-btn${view === 'waiting' ? ' is-on' : ''}`} aria-pressed={view === 'waiting'} onClick={() => setView('waiting')}>Menunggu</button>
                <button type="button" className={`req-btn${view === 'done' ? ' is-on' : ''}`} aria-pressed={view === 'done'} onClick={() => setView('done')}>Sudah selesai</button>
            </div>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat daftar persetujuan. Muat ulang halaman.</p>}
            {data && data.length === 0 && <p className="req-basket__empty">{emptyText}</p>}
            <div className="da-filters">
                <label className="da-field">
                    <input type="search" aria-label="Cari persetujuan" placeholder="Cari judul, nomor tiket, atau pemohon" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <select aria-label="Tipe permintaan" value={kind} onChange={(event) => setKind(event.target.value)}>
                    <option value="">Semua tipe</option>
                    <option value="HARDWARE">Hardware Request</option>
                    <option value="EFORM">E-Form Request</option>
                </select>
            </div>
            {Boolean(data?.length) && rows.length === 0 && <p className="req-basket__empty">Tidak ada persetujuan yang cocok.</p>}
            <ul className="req-approvals">
                {rows.map((row) => (
                    <li key={row.ticketId}>
                        <Link to={`/tickets/${row.ticketId}`} className="req-approvals__row">
                            <span className="req-approvals__main">
                                <RequestTypeTag kind={row.requestKind} />
                                <b>{row.title}</b>
                                <small>#{row.ticketNumber}</small>
                            </span>
                            <span className="req-approvals__who">{row.requesterName}</span>
                            {row.signedAt
                                ? <span className="req-turn">Ditandatangani {signedOn.format(new Date(row.signedAt))} · {row.flowPhaseLabel}</span>
                                : <span className="req-turn req-turn--mine">Menunggu tanda tangan Anda</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
