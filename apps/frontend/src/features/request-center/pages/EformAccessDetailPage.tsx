import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Calendar, ShieldCheck,
  Activity, CheckCircle2, Loader2, ClipboardCheck, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEformDetail, useGetEformPdf } from '../api/eform-request.api';
import { EformStatusPipeline, EFormStatus } from '../components/eform/EformStatusPipeline';
import { useAuth } from '@/stores/useAuth';
import { format } from 'date-fns';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

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

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'VPN': return 'bg-primary/10 text-primary border-primary/20';
      case 'WEBSITE': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'NETWORK': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (isPending) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Memuat data...</p>
    </div>
  );

  if (isError || !request) return <div className="p-8 text-center text-muted-foreground">Permintaan tidak ditemukan</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Button variant="outline" onClick={downloadPdf} className="rounded-xl border-2">
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>

      {/* Status Pipeline */}
      <Card className="p-8 rounded-[3rem] border-2 border-primary/5 shadow-xl shadow-primary/5">
        <EformStatusPipeline
          currentStatus={request.status as EFormStatus}
          formType={request.formType}
          rejectionReason={request.rejectionReason}
        />
      </Card>

      {/* Contextual Action Buttons */}
      {isCurrentApprover && request.status === EFormStatus.PENDING_MANAGER && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/approve`)}
          className="w-full rounded-2xl h-14 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 font-black uppercase tracking-widest text-[10px]"
        >
          <ClipboardCheck className="mr-2" size={18} /> Review & Setujui Permintaan
        </Button>
      )}
      {isICT && request.status === EFormStatus.PENDING_ICT && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/credentials`)}
          className="w-full rounded-2xl h-14 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-black uppercase tracking-widest text-[10px]"
        >
          <Database className="mr-2" size={18} /> Input Kredensial Akses
        </Button>
      )}
      {isRequester && request.status === EFormStatus.CONFIRMED && (
        <Button
          onClick={() => navigate(`${basePath}/eform-access/${id}/credentials`)}
          className="w-full rounded-2xl h-14 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 font-black uppercase tracking-widest text-[10px]"
        >
          <ShieldCheck className="mr-2" size={18} /> Lihat Kredensial Akses
        </Button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 rounded-[2.5rem] border-2 border-primary/10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <FileText size={20} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-primary">Informasi Pengajuan</h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter">Nama Pemohon</label>
                <p className="text-sm font-bold uppercase">{request.requesterName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter">ID Transaksi</label>
                <p className="text-sm font-bold font-mono text-primary">#{request.id.slice(0, 8)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter">Masa Berlaku</label>
                <p className="text-sm font-bold flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  {request.formData?.dariTanggal} - {request.formData?.sampaiTanggal || 'Selamanya'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter">Form Type</label>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter border ${getTypeStyles(request.formType)}`}>
                    {request.formType}
                  </span>
                </div>
              </div>
            </div>

            {request.formType === 'VPN' && request.formData?.kebutuhanAkses && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter block mb-2">Kebutuhan Akses VPN</label>
                <p className="text-sm font-medium leading-relaxed">{request.formData.kebutuhanAkses}</p>
              </div>
            )}
            {request.formType === 'WEBSITE' && request.requestedWebsites && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter block mb-2">Requested Websites</label>
                <p className="text-sm font-medium leading-relaxed">{request.requestedWebsites}</p>
              </div>
            )}
            {request.formType === 'NETWORK' && request.networkPurpose && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter block mb-2">Network Purpose</label>
                <p className="text-sm font-medium leading-relaxed">{request.networkPurpose}</p>
              </div>
            )}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
              <label className="text-[9px] font-black uppercase opacity-40 tracking-tighter block mb-2">Alasan Pengajuan</label>
              <p className="text-sm font-medium leading-relaxed">{request.formData?.alasan}</p>
            </div>
          </Card>
        </div>

        {/* Sidebar / Audit Trail */}
        <div className="space-y-8">
          <Card className="p-6 rounded-[2.5rem] border-2 border-primary/5 bg-muted/10 space-y-6">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              <h4 className="text-[10px] font-black uppercase tracking-widest">Audit Trail</h4>
            </div>

            {(!request.signatures || request.signatures.length === 0) ? (
              <p className="text-[10px] text-muted-foreground opacity-50">Belum ada tanda tangan.</p>
            ) : (
              <div className="space-y-6 relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border/50 -z-10" />
                {request.signatures.map((sig, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 relative z-10">
                      <CheckCircle2 size={12} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold leading-none">{sig.signerName}</p>
                      <p className="text-[9px] font-black uppercase tracking-tighter opacity-40">{sig.signerRole}</p>
                      <p className="text-[8px] opacity-60">{sig.signedAt ? format(new Date(sig.signedAt), 'dd MMM yyyy HH:mm') : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
