import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Send, CheckCircle2, Calendar, Globe, Wifi, FileText, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignaturePad } from '../components/eform/SignaturePad';
import { ManagerSelector } from '../components/eform/ManagerSelector';
import { TermsAndConditions } from '../components/eform/TermsAndConditions';
import { useCreateEformRequest, useVpnTerms } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

type FormType = 'VPN' | 'WEBSITE' | 'NETWORK';

const FORM_TYPES = [
  { id: 'VPN' as FormType, label: 'VPN Access', icon: ShieldCheck, gradient: 'from-blue-600 to-indigo-600', desc: 'Remote ke jaringan kantor' },
  { id: 'WEBSITE' as FormType, label: 'Website Access', icon: Globe, gradient: 'from-purple-600 to-violet-600', desc: 'Buka blokir website' },
  { id: 'NETWORK' as FormType, label: 'Network Access', icon: Wifi, gradient: 'from-orange-500 to-amber-600', desc: 'Akses jaringan khusus' },
];

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.28, ease: 'easeOut' },
  }),
};

export const EformAccessCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Determine portal prefix from current URL
  const basePath = location.pathname.startsWith('/client') ? '/client'
    : location.pathname.startsWith('/manager') ? '/manager'
    : '';

  const [formType, setFormType] = useState<FormType>('VPN');
  const [requesterName, setRequesterName] = useState(user?.fullName || '');
  const [requesterDepartment, setRequesterDepartment] = useState(user?.departmentId || '');
  const [formData, setFormData] = useState({
    kebutuhanAkses: 'Remote PC Kantor',
    alasan: '',
    dariTanggal: new Date().toISOString().split('T')[0],
    sampaiTanggal: '',
  });
  const [requestedWebsites, setRequestedWebsites] = useState('');
  const [networkPurpose, setNetworkPurpose] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [managerId, setManagerId] = useState('');

  const createMutation = useCreateEformRequest();
  const { data: termsData } = useVpnTerms();

  const isValid =
    !!requesterName &&
    !!formData.alasan &&
    !!formData.dariTanggal &&
    termsAccepted &&
    !!signatureData &&
    !!managerId &&
    (formType !== 'WEBSITE' || !!requestedWebsites) &&
    (formType !== 'NETWORK' || !!networkPurpose);

  const filledCount = [
    !!requesterName, !!formData.alasan, !!formData.dariTanggal,
    !!managerId, termsAccepted, !!signatureData,
    formType !== 'WEBSITE' || !!requestedWebsites,
    formType !== 'NETWORK' || !!networkPurpose,
  ].filter(Boolean).length;
  const progressPct = Math.round((filledCount / 8) * 100);

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error('Lengkapi semua field yang wajib diisi');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        formType,
        requesterName,
        requesterDepartment,
        formData,
        requestedWebsites: formType === 'WEBSITE' ? requestedWebsites : undefined,
        networkPurpose: formType === 'NETWORK' ? networkPurpose : undefined,
        termsAccepted,
        signatureData,
        managerId,
      });
      toast.success('Permintaan berhasil dikirim');
      navigate(`${basePath}/eform-access/${result.id}`);
    } catch {
      toast.error('Gagal mengirim permintaan');
    }
  };

  const selectedType = FORM_TYPES.find(t => t.id === formType)!;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Back + Progress */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between"
      >
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{progressPct}% Lengkap</span>
          <div className="w-20 h-1.5 bg-border/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Main card */}
      <div className="rounded-[2rem] overflow-hidden border border-primary/10 shadow-xl shadow-primary/5">
        {/* Dynamic gradient header based on form type */}
        <motion.div
          key={formType}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={`bg-gradient-to-br ${selectedType.gradient} px-8 py-6`}
        >
          <h1 className="text-xl font-black tracking-tighter uppercase text-white">E-Form Access Request</h1>
          <p className="text-[11px] text-white/60 mt-1 font-medium tracking-wide">{selectedType.desc}</p>
        </motion.div>

        {/* Form type tabs */}
        <motion.div
          custom={0} variants={sectionVariants} initial="hidden" animate="visible"
          className="px-8 pt-5 pb-3 bg-background border-b border-border/30"
        >
          <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 mb-3 block">Jenis Akses</label>
          <div className="flex gap-2 flex-wrap">
            {FORM_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFormType(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                  formType === id
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Fields */}
        <div className="px-8 py-6 bg-background space-y-6">
          {/* Section: Identitas */}
          <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={11} className="text-primary" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Identitas Pemohon</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Nama Pemohon *</label>
                <Input
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  placeholder="Nama lengkap"
                  className="h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Departemen</label>
                <Input
                  value={requesterDepartment}
                  onChange={e => setRequesterDepartment(e.target.value)}
                  placeholder="Nama departemen"
                  className="h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
            </div>
          </motion.div>

          {/* Section: Periode */}
          <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar size={11} className="text-primary" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Periode Akses</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Dari Tanggal</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                  <Input
                    type="date"
                    value={formData.dariTanggal}
                    onChange={e => setFormData({ ...formData, dariTanggal: e.target.value })}
                    className="pl-10 h-11 rounded-xl border-border/50 font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Sampai Tanggal</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                  <Input
                    type="date"
                    value={formData.sampaiTanggal}
                    min={formData.dariTanggal}
                    onChange={e => setFormData({ ...formData, sampaiTanggal: e.target.value })}
                    className="pl-10 h-11 rounded-xl border-border/50 font-bold"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Section: Detail Kebutuhan */}
          <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText size={11} className="text-primary" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Detail Kebutuhan</span>
            </div>

            {formType === 'VPN' && (
              <div className="space-y-2 mb-4">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Kebutuhan Akses VPN</label>
                <Input
                  value={formData.kebutuhanAkses}
                  onChange={e => setFormData({ ...formData, kebutuhanAkses: e.target.value })}
                  className="h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
            )}
            {formType === 'WEBSITE' && (
              <div className="space-y-2 mb-4">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Website yang Diminta (URL) *</label>
                <Input
                  value={requestedWebsites}
                  onChange={e => setRequestedWebsites(e.target.value)}
                  placeholder="github.com, stackoverflow.com"
                  className="h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
            )}
            {formType === 'NETWORK' && (
              <div className="space-y-2 mb-4">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tujuan Akses Jaringan *</label>
                <Input
                  value={networkPurpose}
                  onChange={e => setNetworkPurpose(e.target.value)}
                  placeholder="Akses server client XYZ"
                  className="h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Alasan Pengajuan *</label>
              <textarea
                value={formData.alasan}
                onChange={e => setFormData({ ...formData, alasan: e.target.value })}
                placeholder="Tuliskan alasan lengkap mengapa akses ini dibutuhkan..."
                className="w-full min-h-[90px] p-4 rounded-2xl border-2 border-border/50 bg-background text-sm font-medium focus:border-primary/30 outline-none transition-colors resize-none"
              />
            </div>
          </motion.div>

          {/* Section: Otorisasi */}
          <motion.div
            custom={4} variants={sectionVariants} initial="hidden" animate="visible"
            className="border-t border-dashed border-border/40 pt-6 space-y-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock size={11} className="text-primary" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Otorisasi & Tanda Tangan</span>
            </div>

            <ManagerSelector selectedId={managerId} onSelect={setManagerId} />

            <TermsAndConditions
              accepted={termsAccepted}
              onAccept={setTermsAccepted}
              content={termsData?.terms || 'Loading...'}
            />

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan Pemohon</label>
              <SignaturePad signerName={requesterName} onSave={setSignatureData} />
              {signatureData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 dark:bg-green-950/30 p-2 rounded-lg border border-green-100 dark:border-green-900/30"
                >
                  <CheckCircle2 size={13} /> Tanda tangan berhasil dikunci
                </motion.div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid || createMutation.isPending}
              className="w-full rounded-2xl h-14 bg-primary shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-[10px] transition-all duration-200 active:scale-[0.98]"
            >
              {createMutation.isPending ? 'Mengirim...' : 'Kirim Pengajuan'} <Send className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
