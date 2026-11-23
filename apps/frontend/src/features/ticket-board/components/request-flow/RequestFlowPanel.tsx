import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { ScheduleProposeModal } from '@/features/hardware-request/components/scheduling/ScheduleProposeModal';
import { SlotPickerModal } from '@/features/hardware-request/components/scheduling/SlotPickerModal';
import type { HardwareRequestItem, InstallationSchedule } from '@/features/hardware-request/types';
import { AccessCard } from './AccessCard';
import { DocumentPane } from './DocumentPane';
import type { RequestFlowView } from './flowTypes';
import { NextStepBar } from './NextStepBar';
import { ProgressCard } from './ProgressCard';
import { RequestItemsCard } from './RequestItemsCard';
import { flowCalls, useRequestFlow, useRequestFlowAction, type FlowCall } from './useRequestFlow';
import { readQrInBrowser } from './qrReader';
import { ApprovalDialog } from './dialogs/ApprovalDialog';
import { ArrivalDialog } from './dialogs/ArrivalDialog';
import { CredentialDialog, type Credentials } from './dialogs/CredentialDialog';
import { DocNumberDialog } from './dialogs/DocNumberDialog';
import { EditItemsDialog } from './dialogs/EditItemsDialog';
import { FulfillDialog } from './dialogs/FulfillDialog';
import { InstallDoneDialog } from './dialogs/InstallDoneDialog';
import { IssueDialog } from './dialogs/IssueDialog';
import { PaperSignDialog } from './dialogs/PaperSignDialog';
import { ProcurementDialog } from './dialogs/ProcurementDialog';
import { ReviewDialog } from './dialogs/ReviewDialog';
import { RejectDialog } from './dialogs/RejectDialog';
import { basketFromItems, type BasketLine, type CatalogEntry } from './picker/basket';

interface RequestFlowPanelProps {
    ticketId: string;
    ticketNumber: string;
    requesterId?: string;
    requesterName?: string;
    /**
     * Where this instance sits (mockup ticket-unify): `bar` = the next-step bar above the conversation (it also owns the
     * dialogs), `rail` = the progress / items / document cards in the right inspector. Omitted = both, stacked.
     */
    slot?: 'bar' | 'rail';
}

type Dialog =
    | 'review' | 'approve' | 'paper' | 'procure' | 'arrived' | 'schedule' | 'pickSlot' | 'installDone' | 'fulfill' | 'issue'
    | 'editItems' | 'docNumber' | 'credentials' | 'rejectIT' | 'cancelReq' | null;

/** Actions that run at once, with no dialog: the endpoint call each one makes. */
function directCall(act: string, ticketId: string, view: RequestFlowView): FlowCall | null {
    switch (act) {
        case 'remind': return flowCalls.remind(ticketId);
        case 'confirm':
        case 'confirmOnBehalf': return flowCalls.confirm(ticketId, { result: 'OK' });
        case 'startInstall': return view.hardware ? flowCalls.startInstall(view.hardware.requestId) : null;
        default: return null;
    }
}

const DIALOG_ACTS: Record<string, Dialog> = {
    review: 'review', approve: 'approve', paper: 'paper', procure: 'procure', arrived: 'arrived', schedule: 'schedule', reschedule: 'schedule',
    pickSlot: 'pickSlot', installDone: 'installDone', fulfill: 'fulfill', reportIssue: 'issue', editItems: 'editItems', rejectIT: 'rejectIT',
    cancelReq: 'cancelReq', showCred: 'credentials', docNumber: 'docNumber',
};

/** Hardware / E-Form ticket: the next-step bar, the progress, the items or access, the document, and every dialog behind a step. */
export function RequestFlowPanel({ ticketId, ticketNumber, requesterId, requesterName = 'Pemohon', slot }: RequestFlowPanelProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { data: view, isLoading, isError } = useRequestFlow(ticketId, true);
    const action = useRequestFlowAction(ticketId);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [credentials, setCredentials] = useState<Credentials | null>(null);
    const hardwareId = view?.hardware?.requestId ?? '';
    const isIt = view?.viewerRoleInFlow === 'ICT';

    const catalog = useQuery<CatalogEntry[]>({
        queryKey: ['request-flow', 'catalog'],
        enabled: dialog === 'editItems',
        queryFn: async () => ((await api.get('/hardware-requests/catalog', { params: { includeInactive: 'false' } })).data?.data ?? []) as CatalogEntry[],
    });

    const showBar = slot !== 'rail';
    const showCards = slot !== 'bar';
    if (isLoading) return slot === 'bar' ? null : <div className="req-card" aria-busy="true">Memuat…</div>;
    if (isError || !view) return slot === 'rail' ? null : <div className="req-card" role="alert">Gagal memuat alur permintaan. Muat ulang halaman.</div>;

    const send = (call: FlowCall) => action.mutateAsync(call);
    const close = () => setDialog(null);
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['request-flow', ticketId] });
        void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    };
    const openPdf = async (version: number) => {
        try {
            const response = await api.get(`/request-flow/${ticketId}/document.pdf`, { params: { v: version }, responseType: 'blob' });
            const url = URL.createObjectURL(response.data as Blob);
            window.open(url, '_blank', 'noopener');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) { toast.error(getApiErrorMessage(err, 'Gagal mengunduh dokumen')); }
    };

    const onAct = (act: string) => {
        if (act === 'renew') { navigate(`/client/create?type=eform&renewFrom=${ticketId}`); return; }
        if (act === 'tabDoc') { document.getElementById('request-document')?.scrollIntoView({ behavior: 'smooth' }); return; }
        if (act === 'showCred') {
            void api.get(`/request-flow/${ticketId}/credentials`).then((res) => { setCredentials(res.data as Credentials); setDialog('credentials'); })
                .catch((err) => toast.error(getApiErrorMessage(err, 'Gagal membuka kredensial')));
            return;
        }
        const call = directCall(act, ticketId, view);
        if (call) {
            void send(call).then(() => toast.success('Tersimpan')).catch((err) => toast.error(getApiErrorMessage(err, 'Gagal menyimpan')));
            return;
        }
        if (DIALOG_ACTS[act]) setDialog(DIALOG_ACTS[act]);
    };

    const items = view.hardware?.items ?? [];
    const flowItems = items.map((i) => ({ id: i.id, name: i.name, recipient: i.recipient, deliveryStatus: i.deliveryStatus, procurementDecision: i.procurementDecision, quantity: 1 }));
    const basket: BasketLine[] = basketFromItems(items);
    // After an issue IT comes back: the units that already have an asset keep it and need no new code.
    const installedIds = new Set((view.hardware?.assets ?? []).map((asset) => asset.itemId));
    const schedule = view.hardware?.schedule ?? null;
    const arrivedItems = items.filter((i) => i.deliveryStatus === 'ARRIVED') as unknown as HardwareRequestItem[];
    const scheduleRow = schedule ? ({
        id: schedule.id, requestId: hardwareId, proposedSlots: schedule.slots, status: schedule.status, rescheduleCount: schedule.resched,
        technicianId: '', proposedBy: '', confirmedBy: null, locationDetail: null, startedAt: null, completedAt: null,
    } as unknown as InstallationSchedule) : null;

    return (
        <div className={`req-panel${slot ? ` req-panel--${slot}` : ''}`}>
            {showBar && <NextStepBar view={view} onAct={onAct} />}
            {showCards && (
                <div className="req-panel__cards">
                    <ProgressCard view={view} />
                    {view.hardware && <RequestItemsCard items={view.hardware.items} assets={view.hardware.assets} />}
                    {view.eform && <AccessCard eform={view.eform} onEditNumber={isIt ? () => setDialog('docNumber') : undefined} />}
                    <div id="request-document"><DocumentPane revisions={view.revisions} onDownload={(v) => void openPdf(v)} /></div>
                </div>
            )}

            {dialog === 'review' && (
                <ReviewDialog open onClose={close} isHardware={view.kind === 'HARDWARE'} proposedManagerId={view.managerId} requesterId={requesterId}
                    onSubmit={(payload) => send(flowCalls.review(ticketId, payload))} />
            )}
            {dialog === 'approve' && (
                <ApprovalDialog open onClose={close} signerName={user?.fullName ?? ''} requesterName={requesterName} title={ticketNumber}
                    summary={view.hardware ? items.map((i) => `${i.name}${i.recipient ? ` — ${i.recipient}` : ''}`) : [`Akses ${view.eform?.formType ?? ''} (${view.eform?.documentNumber ?? ''})`]}
                    onSubmit={(payload) => send(flowCalls.decision(ticketId, payload))} />
            )}
            {dialog === 'paper' && (
                <PaperSignDialog open onClose={close} ticketNumber={ticketNumber} version={view.documentVersion} onDownload={() => void openPdf(view.documentVersion)}
                    readQr={readQrInBrowser}
                    onSubmit={(file, qr) => {
                        const form = new FormData();
                        form.append('file', file);
                        form.append('qr', qr);
                        return api.post(`/request-flow/${ticketId}/paper-sign`, form).then(refresh);
                    }} />
            )}
            {dialog === 'procure' && <ProcurementDialog open onClose={close} items={items.filter((i) => !i.procurementDecision)} onSubmit={(payload) => send(flowCalls.procure(ticketId, payload))} />}
            {dialog === 'arrived' && <ArrivalDialog open onClose={close} items={items} onSubmit={(payload) => send(flowCalls.arrivals(ticketId, payload))} />}
            {dialog === 'installDone' && (
                <InstallDoneDialog open onClose={close} signerName={user?.fullName ?? ''}
                    items={flowItems.filter((i) => i.deliveryStatus === 'ARRIVED' && !installedIds.has(i.id))} onSubmit={(payload) => send(flowCalls.installDone(ticketId, payload))} />
            )}
            {dialog === 'fulfill' && (
                <FulfillDialog open onClose={close} signerName={user?.fullName ?? ''} formType={view.eform?.formType ?? ''}
                    onSubmit={(payload) => send(flowCalls.fulfill(ticketId, payload))} />
            )}
            {dialog === 'issue' && <IssueDialog open onClose={close} kind={view.kind} onSubmit={(note) => send(flowCalls.confirm(ticketId, { result: 'ISSUE', note }))} />}
            {dialog === 'editItems' && (
                <EditItemsDialog open onClose={close} catalog={catalog.data ?? []} initial={basket} onSubmit={(payload) => send(flowCalls.editItems(ticketId, payload))} />
            )}
            {dialog === 'docNumber' && <DocNumberDialog open onClose={close} current={view.eform?.documentNumber ?? view.hardware?.requestNumber ?? ''} onSubmit={(value) => send(flowCalls.documentNumber(ticketId, value))} />}
            {dialog === 'credentials' && credentials && <CredentialDialog open onClose={close} credentials={credentials} />}
            {dialog === 'rejectIT' && <RejectDialog open onClose={close} title="Tolak permintaan" onSubmit={(reason) => send(flowCalls.rejectByIt(ticketId, reason))} />}
            {dialog === 'cancelReq' && <RejectDialog open onClose={close} title="Batalkan permintaan" confirmLabel="Batalkan permintaan" onSubmit={() => send(flowCalls.cancel(ticketId))} noReason />}
            {dialog === 'schedule' && (
                <ScheduleProposeModal open onOpenChange={(open) => { if (!open) { close(); refresh(); } }} requestId={hardwareId} arrivedItems={arrivedItems} />
            )}
            {dialog === 'pickSlot' && scheduleRow && (
                <SlotPickerModal open onOpenChange={(open) => { if (!open) { close(); refresh(); } }} requestId={hardwareId} schedule={scheduleRow} />
            )}
        </div>
    );
}
