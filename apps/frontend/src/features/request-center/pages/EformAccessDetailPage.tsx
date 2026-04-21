import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Calendar, 
  User, 
  ShieldCheck, 
  Activity,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  useEformDetail, 
  useApproveManager1, 
  useApproveManager2, 
  useConfirmIct, 
  useRejectRequest, 
  useGetEformPdf,
  useGetCredentialsSecure
} from '../api/eform-request.api';
import { EformStatusPipeline, EFormStatus } from '../components/eform/EformStatusPipeline';
import { SignaturePad } from '../components/eform/SignaturePad';
import { ManagerSelector } from '../components/eform/ManagerSelector';
import { CredentialViewer } from '../components/eform/CredentialViewer';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

export const EformAccessDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: request, isLoading } = useEformDetail(id!);
  const downloadPdf = useGetEformPdf(id!);

  const [mgrSignature, setMgrSignature] = useState('');
  const [nextApproverId, setNextApproverId] = useState('');
  
  const [ictUsername, setIctUsername] = useState('');
  const [ictPassword, setIctPassword] = useState('');

  const approve1Mutation = useApproveManager1();
  const approve2Mutation = useApproveManager2();
  const confirmIctMutation = useConfirmIct();
  const rejectMutation = useRejectRequest();
  const { data: secureCreds, refetch: fetchCreds } = useGetCredentialsSecure(id!);

  const handleApproveManager1 = async () => {
    if (!request) return;
    if (request.formType === 'VPN' && !nextApproverId) {
      toast.error('Harap pilih GM/Director untuk persetujuan selanjutnya');
      return;
    }
    try {
      await approve1Mutation.mutateAsync({ 
        id: id!, 
        signatureData: mgrSignature, 
        nextApproverId: request.formType === 'VPN' ? nextApproverId : undefined 
      });
      toast.success('Persetujuan berhasil dikirim');
    } catch (error) {
      toast.error('Gagal memproses persetujuan');
    }
  };

  const handleApproveManager2 = async () => {
    try {
      await approve2Mutation.mutateAsync({ id: id!, signatureData: mgrSignature });
      toast.success('Persetujuan GM berhasil dikirim');
    } catch (error) {
      toast.error('Gagal memproses persetujuan');
    }
  };

  const handleConfirmIct = async () => {
    if (!ictUsername || !ictPassword) {
      toast.error('Harap isi username dan password VPN');
      return;
    }
    try {
      await confirmIctMutation.mutateAsync({ id: id!, username: ictUsername, password: ictPassword });
      toast.success('Provisioning VPN selesai');
    } catch (error) {
      toast.error('Gagal memproses provisioning');
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Alasan penolakan:');
    if (!reason) return;
    try {
      await rejectMutation.mutateAsync({ id: id!, reason });
      toast.success('Permintaan telah ditolak');
    } catch (error) {
      toast.error('Gagal menolak permintaan');
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Decrypting access data...</p>
    </div>
  );

  if (!request) return <div>Request not found</div>;

  const isCurrentApprover = request.currentApproverId === user?.id;
  const isRequester = request.requesterId === user?.id;
  const isIct = user?.role === 'AGENT' || user?.role === 'ADMIN';

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'VPN': return 'bg-primary/10 text-primary border-primary/20';
      case 'WEBSITE': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'NETWORK': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPdf} className="rounded-xl border-2">
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Status Pipeline */}
      <Card className="p-8 rounded-[3rem] border-2 border-primary/5 shadow-xl shadow-primary/5">
        <EformStatusPipeline 
          currentStatus={request.status as EFormStatus} 
          formType={request.formType}
          rejectionReason={request.rejectionReason}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Form Data */}
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

          {/* Action for Manager 1 */}
          {isCurrentApprover && request.status === EFormStatus.PENDING_MANAGER_1 && (
            <Card className="p-8 rounded-[2.5rem] border-2 border-amber-500/20 bg-amber-500/[0.02] space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-700">Approval Atasan Langsung</h3>
              </div>

              <div className="space-y-6">
                {request.formType === 'VPN' && (
                  <ManagerSelector 
                    onSelect={setNextApproverId}
                    selectedId={nextApproverId}
                  />
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan Manajer</label>
                  <SignaturePad 
                    signerName={user?.fullName || ''}
                    onSave={setMgrSignature}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleReject} variant="outline" className="flex-1 rounded-2xl h-14 border-2 font-black uppercase tracking-widest text-[10px] text-destructive border-destructive/20 hover:bg-destructive/5">
                    <XCircle className="mr-2" size={18} /> Tolak
                  </Button>
                  <Button 
                    onClick={handleApproveManager1}
                    disabled={!mgrSignature || (request.formType === 'VPN' && !nextApproverId) || approve1Mutation.isPending}
                    className="flex-[2] rounded-2xl h-14 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 font-black uppercase tracking-widest text-[10px]"
                  >
                    {approve1Mutation.isPending ? 'Memproses...' : 'Setujui & Lanjutkan'} <CheckCircle2 className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Action for Manager 2 (GM) */}
          {isCurrentApprover && request.status === EFormStatus.PENDING_MANAGER_2 && (
            <Card className="p-8 rounded-[2.5rem] border-2 border-primary/20 bg-primary/[0.02] space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-primary">Approval GM / Director</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan GM</label>
                  <SignaturePad 
                    signerName={user?.fullName || ''}
                    onSave={setMgrSignature}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleReject} variant="outline" className="flex-1 rounded-2xl h-14 border-2 font-black uppercase tracking-widest text-[10px] text-destructive border-destructive/20 hover:bg-destructive/5">
                    <XCircle className="mr-2" size={18} /> Tolak
                  </Button>
                  <Button 
                    onClick={handleApproveManager2}
                    disabled={!mgrSignature || approve2Mutation.isPending}
                    className="flex-[2] rounded-2xl h-14 bg-primary text-white shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-[10px]"
                  >
                    {approve2Mutation.isPending ? 'Memproses...' : 'Approve ke ICT'} <CheckCircle2 className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Action for ICT Agent */}
          {isIct && request.status === EFormStatus.PENDING_ICT && (
            <Card className="p-8 rounded-[2.5rem] border-2 border-blue-500/20 bg-blue-500/[0.02] space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Activity size={20} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-700">ICT Provisioning</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Username VPN</label>
                  <Input value={ictUsername} onChange={e => setIctUsername(e.target.value)} className="h-12 rounded-xl" placeholder="Contoh: sja\jdoe" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Password Sementara</label>
                  <Input value={ictPassword} onChange={e => setIctPassword(e.target.value)} className="h-12 rounded-xl" placeholder="••••••••" />
                </div>
                
                <div className="pt-4 flex gap-3">
                  <Button onClick={handleReject} variant="outline" className="flex-1 rounded-2xl h-14 border-2 font-black uppercase tracking-widest text-[10px] text-destructive border-destructive/20 hover:bg-destructive/5">
                    <XCircle className="mr-2" size={18} /> Tolak
                  </Button>
                  <Button 
                    onClick={handleConfirmIct}
                    disabled={!ictUsername || !ictPassword || confirmIctMutation.isPending}
                    className="flex-[2] rounded-2xl h-14 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-black uppercase tracking-widest text-[10px]"
                  >
                    {confirmIctMutation.isPending ? 'Mengirim...' : 'Konfirmasi & Kirim Kredensial'} <CheckCircle2 className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Credentials Viewer (For requester when confirmed) */}
          {request.status === EFormStatus.CONFIRMED && isRequester && (
            <div className="space-y-4">
              {!secureCreds ? (
                <Button 
                  onClick={() => fetchCreds()}
                  className="w-full rounded-2xl h-14 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 font-black uppercase tracking-widest text-[10px]"
                >
                  <ShieldCheck className="mr-2" size={18} /> Lihat Kredensial VPN Aman
                </Button>
              ) : (
                <CredentialViewer 
                  isRequester={true}
                  username={secureCreds.username}
                  password={secureCreds.password}
                />
              )}
            </div>
          )}
        </div>

        {/* Sidebar / Timeline */}
        <div className="space-y-8">
          <Card className="p-6 rounded-[2.5rem] border-2 border-primary/5 bg-muted/10 space-y-6">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              <h4 className="text-[10px] font-black uppercase tracking-widest">Audit Trail</h4>
            </div>

            <div className="space-y-6 relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border/50 -z-10" />
              
              {request.signatures?.map((sig, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 relative z-10">
                    <CheckCircle2 size={12} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold leading-none">{sig.signerName}</p>
                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-40">{sig.signerRole}</p>
                    <p className="text-[8px] opacity-60">{format(new Date(sig.signedAt), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
