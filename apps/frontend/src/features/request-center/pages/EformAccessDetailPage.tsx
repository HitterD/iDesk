import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Calendar, ShieldCheck,
  Activity, CheckCircle2, ClipboardCheck, Database,
  Server, Eye, FileEdit, Ban, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEformDetail, useGetEformPdf, useFulfillRequest, useRejectRequest } from '../api/eform-request.api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { EformStatusPipeline, EFormStatus } from '../components/eform/EformStatusPipeline';
import { EformTypeBadge, getTypeConfig, ICT_ROLES } from '../components/eform/eform-vocabulary';
import { useAuth } from '@/stores/useAuth';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';


const SIGNER_ROLE_LABELS: Record<string, string> = {
  REQUESTER: 'Pemohon',
  MANAGER: 'Atasan',
  ICT: 'Tim ICT',
};

export const EformAccessDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: request, isPending, isError } = useEformDetail(id!);
  const downloadPdf = useGetEformPdf(id!);

  const isCurrentApprover = request?.currentApproverId === user?.id;
  const isRequester = request?.requesterId === user?.id;
  const isICT = ICT_ROLES.includes(user?.role || '');

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/portal';

  const fulfillMutation = useFulfillRequest();
  const rejectMutation = useRejectRequest();

  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [fulfillAccountName, setFulfillAccountName] = useState('');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (request) {
      setFulfillAccountName(request.formData?.synologyAccountName || request.formData?.fulfilledAccountName || '');
    }
  }, [request]);

  const handleFulfill = async () => {
    if (!fulfillNotes.trim()) {
      toast.error('Catatan realisasi wajib diisi');
      return;
    }
    try {
      await fulfillMutation.mutateAsync({
        id: id!,
        notes: fulfillNotes.trim(),
        accountName: fulfillAccountName.trim() || undefined,
      });
      toast.success('Permintaan akses folder berhasil direalisasikan');
      setFulfillOpen(false);
    } catch {
      toast.error('Gagal merealisasikan permintaan akses');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Alasan penolakan wajib diisi');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        id: id!,
        reason: rejectReason.trim(),
      });
      toast.success('Permintaan berhasil ditolak');
      setRejectOpen(false);
    } catch {
      toast.error('Gagal menolak permintaan');
    }
  };

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-muted" />
        <div className="h-64 rounded-2xl border border-border bg-card p-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-96 rounded-2xl border border-border bg-card p-6 lg:col-span-2" />
          <div className="h-96 rounded-2xl border border-border bg-card p-6" />
        </div>
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <FileText size={40} className="mx-auto text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-bold text-foreground">Permintaan tidak ditemukan</h2>
        <p className="text-sm text-muted-foreground">Permintaan ini mungkin sudah dihapus.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-semibold">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
      </div>
    );
  }

  const type = getTypeConfig(request.formType);
  const hasNasSelections =
    request.formType === 'SYNOLOGY_NAS' &&
    Array.isArray(request.formData?.nasSelections) &&
    request.formData.nasSelections.length > 0;

  const detailBlocks = [
    request.formType === 'VPN' && request.formData?.kebutuhanAkses
      ? { label: 'Kebutuhan akses VPN', value: request.formData.kebutuhanAkses }
      : null,
    request.formType === 'WEBSITE' && request.requestedWebsites
      ? { label: 'Website yang diminta', value: request.requestedWebsites }
      : null,
    request.formType === 'NETWORK' && request.networkPurpose
      ? { label: 'Tujuan akses jaringan', value: request.networkPurpose }
      : null,
    request.formType === 'FLASHDISK' && request.formData?.hostname
      ? { label: 'Hostname / Nama Komputer', value: request.formData.hostname }
      : null,
    request.formType === 'FLASHDISK' && request.formData?.accessLevel
      ? {
          label: 'Tipe Akses USB',
          value: request.formData.accessLevel === 'READ_WRITE'
            ? 'Read & Write (Baca & Tulis)'
            : 'Read Only (Hanya Baca)',
        }
      : null,
    request.formType === 'FLASHDISK' && request.formData?.flashdiskInfo
      ? { label: 'Keterangan Flashdisk', value: request.formData.flashdiskInfo }
      : null,
    request.formType === 'EMAIL' && request.formData?.proposedEmail
      ? {
          label: 'Usulan Email',
          value: request.formData.proposedEmail.includes('@')
            ? request.formData.proposedEmail
            : `${request.formData.proposedEmail}${request.formData?.emailDomain || '@kapalapi.co.id'}`,
        }
      : null,
    request.formType === 'EMAIL' && request.formData?.accountType
      ? {
          label: 'Tipe Akun Email',
          value: request.formData.accountType === 'SHARING' ? 'Sharing / Departemen' : 'Personal / Karyawan',
        }
      : null,
    request.formType === 'SYNOLOGY_NAS' && !hasNasSelections && request.formData?.folderPath
      ? { label: 'Folder / Path NAS', value: request.formData.folderPath }
      : null,
    request.formType === 'SYNOLOGY_NAS' && !hasNasSelections && request.formData?.accessLevel
      ? {
          label: 'Hak Akses NAS',
          value: request.formData.accessLevel === 'READ_WRITE'
            ? 'Read & Write (Baca & Tulis)'
            : 'Read Only (Hanya Baca)',
        }
      : null,
    request.formType === 'SYNOLOGY_NAS'
      ? { label: 'Tipe Akun', value: 'Akun Sharing (Shared Folder)' }
      : null,
    { label: 'Alasan pengajuan', value: request.formData?.alasan || '—' },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-6 py-6 sm:py-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-xl font-semibold cursor-pointer shrink-0">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali
        </Button>
        <Button
          variant={request.status === EFormStatus.CONFIRMED ? 'default' : 'outline'}
          size="sm"
          onClick={downloadPdf}
          className="rounded-xl font-bold shadow-xs cursor-pointer text-xs sm:text-sm shrink-0"
        >
          <Download className="mr-1.5 h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">
            {request.status === EFormStatus.CONFIRMED ? 'Export PDF Resmi (F-ICT-04)' : 'Unduh Draft PDF'}
          </span>
          <span className="sm:hidden">
            {request.status === EFormStatus.CONFIRMED ? 'PDF Resmi' : 'Draft PDF'}
          </span>
        </Button>
      </div>

      {/* Confirmed / ACC Banner */}
      {request.status === EFormStatus.CONFIRMED && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Pengajuan Akses Telah Terealisasi (ACC)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dokumen resmi F-ICT-04 telah lengkap dengan tanda tangan pemohon, atasan, dan verifikasi ICT.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={downloadPdf}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 w-full sm:w-auto cursor-pointer"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Unduh PDF Resmi
          </Button>
        </div>
      )}

      {/* Status pipeline */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 md:p-8 shadow-xs">
        <EformStatusPipeline
          currentStatus={request.status as EFormStatus}
          formType={request.formType}
          rejectionReason={request.rejectionReason}
        />
      </div>

      {/* Contextual action */}
      {isCurrentApprover && request.status === EFormStatus.PENDING_MANAGER && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/approve`)}
          className="h-12 w-full rounded-xl text-sm font-bold shadow-md cursor-pointer"
        >
          <ClipboardCheck className="mr-2 h-4 w-4" /> Tinjau &amp; setujui permintaan
        </Button>
      )}
      {isICT && request.status === EFormStatus.PENDING_ICT && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/credentials`)}
          className="h-12 w-full rounded-xl text-sm font-bold shadow-md cursor-pointer"
        >
          <Database className="mr-2 h-4 w-4" /> Siapkan kredensial akses
        </Button>
      )}
      {isRequester && request.status === EFormStatus.CONFIRMED && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/credentials`)}
          className="h-12 w-full rounded-xl text-sm font-bold shadow-md cursor-pointer"
        >
          <ShieldCheck className="mr-2 h-4 w-4" /> Lihat kredensial akses
        </Button>
      )}

      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6 md:p-8 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText size={20} aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-foreground">Informasi pengajuan</h2>
            </div>

            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Nama pemohon</dt>
                <dd className="mt-1 text-sm font-bold text-foreground">{request.requesterName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">ID transaksi</dt>
                <dd className="mt-1 font-mono text-sm font-bold text-primary">
                  #{request.id.slice(0, 8).toUpperCase()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Masa berlaku</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Calendar size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  {request.formData?.dariTanggal || '—'} — {request.formData?.sampaiTanggal || 'Selamanya'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Jenis akses</dt>
                <dd className="mt-1">
                  <EformTypeBadge type={request.formType} />
                </dd>
              </div>
            </dl>

            {/* NAS Selections Table */}
            {hasNasSelections && (
              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Server size={16} className="text-primary" />
                    Daftar Folder Synology NAS ({request.formData.nasSelections.length} folder)
                  </h3>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">No</th>
                        <th className="py-2.5 px-3">Lokasi NAS</th>
                        <th className="py-2.5 px-3">Direktori / Path Folder</th>
                        <th className="py-2.5 px-3 text-right sm:text-left">Hak Akses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {request.formData.nasSelections.map((sel: any, idx: number) => {
                        const isRW = sel.accessLevel === 'READ_WRITE';
                        return (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                <Server size={13} className="text-primary/70 shrink-0" />
                                {sel.nasName || `Synology ${sel.nasId}`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs text-foreground/90 break-all">
                              {sel.folderPath}
                            </td>
                            <td className="py-2.5 px-3 text-right sm:text-left">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                                  isRW
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                                )}
                              >
                                {isRW ? (
                                  <>
                                    <FileEdit size={11} className="shrink-0" />
                                    <span>Read &amp; Write</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye size={11} className="shrink-0" />
                                    <span>Read Only</span>
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <dl className="space-y-3 border-t border-border pt-6">
              {detailBlocks.map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-4">
                  <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Sidebar / audit trail */}
        <aside className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Activity size={16} className="text-primary" aria-hidden="true" />
              Riwayat persetujuan
            </h2>

            {!request.signatures || request.signatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada tanda tangan pada permintaan ini.
              </p>
            ) : (
              <ol className="relative space-y-5">
                <div
                  className="absolute bottom-2 left-[11px] top-2 w-px bg-border"
                  aria-hidden="true"
                />
                {request.signatures.map((sig, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                      <CheckCircle2 size={12} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-bold leading-tight text-foreground">
                        {sig.signerName}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {SIGNER_ROLE_LABELS[sig.signerRole] ?? sig.signerRole}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sig.signedAt
                          ? format(new Date(sig.signedAt), 'd MMM yyyy, HH:mm', { locale: idLocale })
                          : '—'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            {type.description}. Permintaan diteruskan ke atasan Anda, lalu ke tim ICT untuk disiapkan.
          </p>
        </aside>
      </div>
      {/* Dialog Fulfill Request (ICT Realization) */}
      <Dialog open={fulfillOpen} onOpenChange={setFulfillOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Realisasi Akses Folder Synology
            </DialogTitle>
            <DialogDescription>
              Konfirmasikan bahwa folder yang diminta telah ditambahkan ke akun Synology pemohon tanpa perlu menerbitkan kredensial login baru.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nama Akun Synology
              </label>
              <Input
                value={fulfillAccountName}
                onChange={e => setFulfillAccountName(e.target.value)}
                placeholder="Nama akun pemohon di Synology"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Nama akun yang diberikan izin folder (default dari isian form pemohon).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Catatan Realisasi ICT <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={fulfillNotes}
                onChange={e => setFulfillNotes(e.target.value)}
                placeholder="Contoh: Hak akses Read & Write ke folder IT_Projects telah diberikan pada akun bagas.pratama."
                className="min-h-[90px] text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFulfillOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleFulfill}
              disabled={fulfillMutation.isPending || !fulfillNotes.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {fulfillMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Selesaikan Akses
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Reject Request */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Tolak Permintaan Akses
            </DialogTitle>
            <DialogDescription>
              Berikan alasan mengapa permintaan akses ini ditolak. Alasan ini akan tercatat dalam audit trail dan ditampilkan pada pemohon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Alasan Penolakan <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Folder yang diminta tidak sesuai dengan otorisasi departemen pemohon..."
              className="min-h-[100px] text-sm resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              className="font-bold"
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses…
                </>
              ) : (
                <>
                  <Ban className="mr-2 h-4 w-4" /> Tolak Permintaan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
