import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '../components/eform/SignaturePad';
import { useEformDetail, useApproveByManager } from '../api/eform-request.api';
import { EFormStatus } from '../components/eform/EformStatusPipeline';
import { EformStatusBadge, EformTypeBadge, getTypeConfig } from '../components/eform/eform-vocabulary';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

const formatSignedAt = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

export const EformApprovalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eform, isLoading } = useEformDetail(id!);
  const approveMutation = useApproveByManager();

  const [signatureData, setSignatureData] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isMyApproval = eform?.currentApproverId === user?.id;
  const isPendingManager = eform?.status === EFormStatus.PENDING_MANAGER;
  const canAct = isMyApproval && isPendingManager;

  const requesterSig = eform?.signatures?.find(s => s.signerRole === 'REQUESTER');

  const handleApprove = async () => {
    if (!signatureData) {
      toast.error('Harap tanda tangani terlebih dahulu');
      return;
    }
    try {
      await approveMutation.mutateAsync({ id: id!, action: 'APPROVE', signatureData });
      toast.success('Permintaan disetujui');
      navigate(-1);
    } catch {
      toast.error('Gagal menyetujui permintaan');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Harap isi alasan penolakan');
      return;
    }
    try {
      await approveMutation.mutateAsync({ id: id!, action: 'REJECT', rejectionReason });
      toast.success('Permintaan ditolak');
      navigate(-1);
    } catch {
      toast.error('Gagal menolak permintaan');
    }
  };

  const backButton = (
    <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-semibold">
      <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
    </Button>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!eform) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <ShieldAlert size={40} className="mx-auto text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-bold text-foreground">Permintaan tidak ditemukan</h2>
        <p className="text-sm text-muted-foreground">Permintaan ini mungkin sudah dihapus.</p>
        {backButton}
      </div>
    );
  }

  const type = getTypeConfig(eform.formType);

  const infoRows = [
    { label: 'Nama pemohon', value: eform.requesterName },
    { label: 'Departemen', value: eform.requesterDepartment || '—' },
    { label: 'Jenis akses', value: type.label },
    { label: 'Dari tanggal', value: eform.formData?.dariTanggal || '—' },
    { label: 'Sampai tanggal', value: eform.formData?.sampaiTanggal || 'Selamanya' },
    { label: 'ID transaksi', value: `#${eform.id.slice(0, 8).toUpperCase()}` },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        {backButton}
        <EformStatusBadge status={eform.status} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-6 py-5">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Tinjau permintaan akses
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              #{eform.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <EformTypeBadge type={eform.formType} />
        </div>

        <div className="space-y-5 px-6 py-6">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {infoRows.map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-bold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          {eform.formType === 'WEBSITE' && eform.requestedWebsites && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h2 className="text-xs font-semibold text-muted-foreground">Website yang diminta</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{eform.requestedWebsites}</p>
            </div>
          )}
          {eform.formType === 'NETWORK' && eform.networkPurpose && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h2 className="text-xs font-semibold text-muted-foreground">Tujuan akses jaringan</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{eform.networkPurpose}</p>
            </div>
          )}

          {eform.formData?.alasan && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h2 className="text-xs font-semibold text-muted-foreground">Alasan pengajuan</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{eform.formData.alasan}</p>
            </div>
          )}

          {/* Requester signature (read-only) */}
          {requesterSig && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Tanda tangan pemohon</h2>
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <img
                  src={requesterSig.signatureData}
                  alt={`Tanda tangan ${requesterSig.signerName}`}
                  className="max-h-24 rounded-lg bg-white object-contain"
                />
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Nama terang</dt>
                    <dd className="mt-0.5 text-sm font-bold text-foreground">{requesterSig.signerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Tanggal tanda tangan</dt>
                    <dd className="mt-0.5 text-sm font-bold text-foreground">
                      {formatSignedAt(requesterSig.signedAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {/* Manager action area */}
          {canAct && (
            <div className="space-y-5 border-t border-border pt-5">
              {!showRejectInput ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-foreground">Tanda tangan Anda (atasan)</h2>
                    <SignaturePad signerName={user?.fullName || ''} onSave={setSignatureData} />
                    {signatureData && (
                      <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 size={15} aria-hidden="true" /> Tanda tangan sudah dikunci
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      onClick={handleApprove}
                      disabled={!signatureData || approveMutation.isPending}
                      className="h-12 rounded-xl text-sm font-bold"
                    >
                      {approveMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses…</>
                      ) : (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Setujui</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectInput(true)}
                      className="h-12 rounded-xl border-destructive/40 text-sm font-bold text-destructive hover:bg-destructive/5"
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Tolak
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="reject-reason" className="block text-sm font-semibold text-foreground">
                      Alasan penolakan <span className="text-destructive">*</span>
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Alasan ini dikirimkan ke pemohon, jadi jelaskan sejelas mungkin.
                    </p>
                    <textarea
                      id="reject-reason"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Tuliskan alasan penolakan…"
                      className="min-h-[90px] w-full resize-none rounded-xl border border-border bg-background p-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-destructive"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      onClick={handleReject}
                      disabled={!rejectionReason.trim() || approveMutation.isPending}
                      className="h-12 rounded-xl bg-destructive text-sm font-bold text-white hover:bg-destructive/90"
                    >
                      {approveMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses…</>
                      ) : (
                        <><XCircle className="mr-2 h-4 w-4" /> Konfirmasi tolak</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowRejectInput(false)}
                      className="h-12 rounded-xl text-sm font-bold"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!canAct && isPendingManager && !isMyApproval && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300">
              Permintaan ini menunggu persetujuan atasan lain.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
