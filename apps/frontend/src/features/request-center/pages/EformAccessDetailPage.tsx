import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Calendar, ShieldCheck,
  Activity, CheckCircle2, ClipboardCheck, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEformDetail, useGetEformPdf } from '../api/eform-request.api';
import { EformStatusPipeline, EFormStatus } from '../components/eform/EformStatusPipeline';
import { EformTypeBadge, getTypeConfig } from '../components/eform/eform-vocabulary';
import { useAuth } from '@/stores/useAuth';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

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

  const basePath = location.pathname.startsWith('/client') ? '/client'
    : location.pathname.startsWith('/manager') ? '/manager'
    : '';

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-9 w-36 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
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
    { label: 'Alasan pengajuan', value: request.formData?.alasan || '—' },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-semibold">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Button
          variant={request.status === EFormStatus.CONFIRMED ? 'default' : 'outline'}
          onClick={downloadPdf}
          className="rounded-xl font-bold shadow-xs"
        >
          <Download className="mr-2 h-4 w-4" />
          {request.status === EFormStatus.CONFIRMED ? 'Export PDF Resmi (F-ICT-04)' : 'Unduh Draft PDF'}
        </Button>
      </div>

      {/* Confirmed / ACC Banner */}
      {request.status === EFormStatus.CONFIRMED && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Pengajuan Akses Telah Terealisasi (ACC)</p>
              <p className="text-xs text-muted-foreground">
                Dokumen resmi F-ICT-04 telah lengkap dengan tanda tangan pemohon, atasan, dan verifikasi ICT.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={downloadPdf}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Unduh PDF Resmi
          </Button>
        </div>
      )}

      {/* Status pipeline */}
      <div className="rounded-2xl border border-border bg-card p-8">
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
          className="h-12 w-full rounded-xl text-sm font-bold"
        >
          <ClipboardCheck className="mr-2 h-4 w-4" /> Tinjau &amp; setujui permintaan
        </Button>
      )}
      {isICT && request.status === EFormStatus.PENDING_ICT && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/credentials`)}
          className="h-12 w-full rounded-xl text-sm font-bold"
        >
          <Database className="mr-2 h-4 w-4" /> Siapkan kredensial akses
        </Button>
      )}
      {isRequester && request.status === EFormStatus.CONFIRMED && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/credentials`)}
          className="h-12 w-full rounded-xl text-sm font-bold"
        >
          <ShieldCheck className="mr-2 h-4 w-4" /> Lihat kredensial akses
        </Button>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-6 rounded-2xl border border-border bg-card p-8">
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
    </div>
  );
};
