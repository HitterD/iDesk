import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, ShieldAlert, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '../components/eform/SignaturePad';
import { useEformDetail, useApproveByManager } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

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
  const isPendingManager = eform?.status === 'PENDING_MANAGER';
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

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Memuat data...</p>
    </div>
  );
  if (!eform) return (
    <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
      <ShieldAlert size={48} className="mx-auto text-muted-foreground/40" />
      <h2 className="text-xl font-black uppercase tracking-tighter">Tidak Ditemukan</h2>
      <p className="text-sm text-muted-foreground">Permintaan tidak ditemukan atau telah dihapus.</p>
      <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
        <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
      </Button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between"
      >
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
        <Badge variant={isPendingManager ? 'outline' : 'secondary'} className="rounded-xl px-3 py-1 font-black uppercase tracking-widest text-[9px]">
          {isPendingManager ? <><Clock size={11} className="mr-1 animate-pulse" /> Menunggu Persetujuan</> : eform.status}
        </Badge>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="rounded-[2rem] overflow-hidden border border-primary/10 shadow-xl shadow-amber-500/5"
      >
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-8 py-6">
          <h1 className="text-xl font-black tracking-tighter uppercase text-white">Review Permintaan Akses</h1>
          <p className="text-[11px] text-white/70 mt-1">#{eform.id.slice(0, 8).toUpperCase()} — {eform.formType}</p>
        </div>

        <div className="px-8 py-6 bg-background space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nama Pemohon', value: eform.requesterName, icon: null },
              { label: 'Departemen', value: eform.requesterDepartment || '-', icon: null },
              { label: 'Jenis Akses', value: eform.formType, icon: null },
              { label: 'Dari Tanggal', value: eform.formData?.dariTanggal || '-', icon: null },
              { label: 'Sampai Tanggal', value: eform.formData?.sampaiTanggal || 'Selamanya', icon: null },
              { label: 'ID Transaksi', value: `#${eform.id.slice(0, 8)}`, icon: null },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-xl p-3">
                <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1">{label}</div>
                <div className="text-sm font-bold">{value}</div>
              </div>
            ))}
          </div>

          {(eform.formType === 'WEBSITE' && eform.requestedWebsites) && (
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-900/30">
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-purple-600 mb-2">Website yang Diminta</div>
              <p className="text-sm font-medium leading-relaxed">{eform.requestedWebsites}</p>
            </div>
          )}
          {(eform.formType === 'NETWORK' && eform.networkPurpose) && (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-4 border border-orange-200/50 dark:border-orange-900/30">
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-orange-600 mb-2">Tujuan Akses Jaringan</div>
              <p className="text-sm font-medium leading-relaxed">{eform.networkPurpose}</p>
            </div>
          )}

          {eform.formData?.alasan && (
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-2">Alasan Pengajuan</div>
              <p className="text-sm font-medium leading-relaxed">{eform.formData.alasan}</p>
            </div>
          )}

          {/* Requester signature (read-only) */}
          {requesterSig && (
            <div className="space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan Pemohon</div>
              <div className="border-2 border-border/30 rounded-2xl p-4 bg-muted/20 space-y-3">
                <img src={requesterSig.signatureData} alt="TTD Pemohon" className="max-h-24 object-contain" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Nama Terang</div>
                    <div className="text-sm font-bold mt-1">{requesterSig.signerName}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Tanggal TTD</div>
                    <div className="text-sm font-bold mt-1">
                      {requesterSig.signedAt ? new Date(requesterSig.signedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manager action area */}
          {canAct && (
            <div className="border-t border-dashed border-border/40 pt-5 space-y-5">
              {!showRejectInput ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
                      Tanda Tangan Anda (Atasan)
                    </label>
                    <SignaturePad signerName={user?.fullName || ''} onSave={setSignatureData} />
                    {signatureData && (
                      <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 dark:bg-green-950/30 p-2 rounded-lg border border-green-100">
                        <CheckCircle2 size={13} /> Tanda tangan dikunci
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={!signatureData || approveMutation.isPending}
                      className="rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-[10px] text-white shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="mr-2 w-4 h-4" /> Setujui
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectInput(true)}
                      className="rounded-2xl h-12 border-destructive/40 text-destructive font-black uppercase tracking-widest text-[10px] hover:bg-destructive/5"
                    >
                      <XCircle className="mr-2 w-4 h-4" /> Tolak
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 text-destructive">
                      Alasan Penolakan *
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Tuliskan alasan penolakan..."
                      className="w-full min-h-[80px] p-4 rounded-2xl border-2 border-destructive/30 bg-background text-sm font-medium outline-none resize-none focus:border-destructive/60 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleReject}
                      disabled={!rejectionReason.trim() || approveMutation.isPending}
                      className="rounded-2xl h-12 bg-destructive font-black uppercase tracking-widest text-[10px] text-white"
                    >
                      <XCircle className="mr-2 w-4 h-4" /> Konfirmasi Tolak
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowRejectInput(false)}
                      className="rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!canAct && eform.status === 'PENDING_MANAGER' && !isMyApproval && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 text-center">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Permintaan ini menunggu persetujuan atasan lain.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
