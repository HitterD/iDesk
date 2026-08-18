import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Calendar as CalendarIcon,
  User,
  Loader2,
  ChevronDown,
  Monitor,
  Network,
  Check,
  Globe,
  Wifi,
  ShieldCheck,
  Infinity as InfinityIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SignaturePad } from '../components/eform/SignaturePad';
import { ManagerSelector } from '../components/eform/ManagerSelector';
import { TermsAndConditions } from '../components/eform/TermsAndConditions';
import { EFORM_TYPES, getTypeConfig } from '../components/eform/eform-vocabulary';
import { useCreateEformRequest, useVpnTerms } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type FormType = 'VPN' | 'WEBSITE' | 'NETWORK';

// VPN Need Options
const VPN_NEED_OPTIONS = [
  {
    id: 'Remote PC Kantor',
    label: 'Remote PC Kantor',
    description: 'Mengakses komputer kerja fisik di kantor dari jarak jauh',
    icon: Monitor,
  },
  {
    id: 'Akses Jaringan Kantor',
    label: 'Akses Jaringan Kantor',
    description: 'Koneksi ke subnet, resource, & database internal kantor',
    icon: Network,
  },
] as const;

// Dynamic reason templates tailored per access type
const REASON_TEMPLATES_BY_TYPE: Record<FormType, string[]> = {
  VPN: [
    'Work From Home (WFH) untuk remote komputer kerja kantor',
    'Akses aplikasi dan database internal kantor dari luar',
    'Penugasan kerja / dinas di luar kantor',
    'Kebutuhan akses pekerjaan mendesak di luar jam operasional',
  ],
  WEBSITE: [
    'Kebutuhan riset dan referensi materi pekerjaan',
    'Akses portal / dokumentasi resmi vendor & mitra kerja',
    'Akses tools dan layanan pendukung pekerjaan',
  ],
  NETWORK: [
    'Koneksi ke server aplikasi & database internal kantor',
    'Akses file sharing (NAS / Shared Folder) antar divisi',
    'Integrasi perangkat kerja ke subnet lokal kantor',
  ],
};

const parseDateString = (str?: string): Date | undefined => {
  if (!str) return undefined;
  const [year, month, day] = str.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

const formatDateToString = (date?: Date): string => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateIndonesian = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = parseDateString(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const EformAccessCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const basePath = location.pathname.startsWith('/client')
    ? '/client'
    : location.pathname.startsWith('/manager')
      ? '/manager'
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
  const [vpnDropdownOpen, setVpnDropdownOpen] = useState(false);

  const createMutation = useCreateEformRequest();
  const { data: termsData, isLoading: termsLoading } = useVpnTerms();

  // Max 12 months validation helper
  const isDurationValid = useMemo(() => {
    if (formType === 'WEBSITE') return true; // Website can be permanent or any duration
    if (!formData.sampaiTanggal) return false; // VPN & Network must have end date
    const start = parseDateString(formData.dariTanggal);
    const end = parseDateString(formData.sampaiTanggal);
    if (!start || !end) return false;
    if (end < start) return false;
    // Difference in days (366 days max for 1 year)
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 366;
  }, [formType, formData.dariTanggal, formData.sampaiTanggal]);

  const isValid =
    !!requesterName &&
    !!formData.alasan.trim() &&
    !!formData.dariTanggal &&
    isDurationValid &&
    termsAccepted &&
    !!signatureData &&
    !!managerId &&
    (formType !== 'WEBSITE' || !!requestedWebsites.trim()) &&
    (formType !== 'NETWORK' || !!networkPurpose.trim());

  // Handle access type switch with duration adaptation
  const handleFormTypeChange = (newType: FormType) => {
    setFormType(newType);
    if (newType !== 'WEBSITE' && !formData.sampaiTanggal) {
      // Default to 12 months for VPN / Network if it was permanent
      const start = parseDateString(formData.dariTanggal) || new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(end) }));
    }
  };

  // Duration preset handlers
  const handleSetDurationPreset = (months: number) => {
    const start = parseDateString(formData.dariTanggal) || new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(end) }));
  };

  const handleSetPermanent = () => {
    if (formType !== 'WEBSITE') {
      toast.warning('Akses VPN dan Jaringan maksimal 12 bulan (1 tahun)');
      return;
    }
    setFormData(prev => ({ ...prev, sampaiTanggal: '' }));
  };


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
      toast.success('Permintaan akses berhasil diajukan');
      navigate(`${basePath}/eform-access/${result.id}`);
    } catch {
      toast.error('Gagal mengirim permintaan');
    }
  };

  const selectedType = getTypeConfig(formType);
  const selectedVpnOption = VPN_NEED_OPTIONS.find(opt => opt.id === formData.kebutuhanAkses) || VPN_NEED_OPTIONS[0];
  const activeTemplates = REASON_TEMPLATES_BY_TYPE[formType] || [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 animate-in fade-in duration-200">
      {/* Top Bar: Back Button & Title */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="rounded-xl font-medium h-9 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali
        </Button>
      </div>

      {/* Main Form Container */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {/* Header */}
        <div className="border-b border-border/70 px-6 py-5 bg-muted/20">
          <h1 className="text-xl font-bold text-foreground">Ajukan Akses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{selectedType.description}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Jenis Akses Toggle */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Jenis Akses
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EFORM_TYPES.map(({ id, label, icon: Icon }) => {
                const isActive = formType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleFormTypeChange(id)}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    <Icon size={16} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Identitas Pemohon */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Identitas Pemohon
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Nama Lengkap <span className="text-destructive">*</span></span>
                <Input
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  placeholder="Nama pemohon"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Departemen</span>
                <Input
                  value={requesterDepartment}
                  onChange={e => setRequesterDepartment(e.target.value)}
                  placeholder="Nama departemen"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
            </div>
          </div>

          {/* Periode Akses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Periode Akses {formType !== 'WEBSITE' && <span className="text-[10px] font-normal lowercase text-muted-foreground">(maks. 12 bulan)</span>}
              </label>
              {/* Presets */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetDurationPreset(1)}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  +1 Bln
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDurationPreset(3)}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  +3 Bln
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDurationPreset(6)}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  +6 Bln
                </button>
                {formType === 'WEBSITE' ? (
                  <button
                    type="button"
                    onClick={handleSetPermanent}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer",
                      !formData.sampaiTanggal
                        ? "border-primary/50 bg-primary/10 text-primary font-bold"
                        : "border-border/80 bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    Permanen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDurationPreset(12)}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    +12 Bln (1 Thn)
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Dari Tanggal <span className="text-destructive">*</span></span>
                <ModernDatePicker
                  value={parseDateString(formData.dariTanggal)}
                  onChange={date => setFormData(prev => ({ ...prev, dariTanggal: formatDateToString(date) }))}
                  placeholder="Mulai tanggal"
                  triggerClassName="h-10 bg-background"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Sampai Tanggal {formType === 'WEBSITE' ? '(Opsional)' : <span className="text-destructive">*</span>}
                </span>
                <ModernDatePicker
                  value={parseDateString(formData.sampaiTanggal)}
                  onChange={date => setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(date) }))}
                  minDate={parseDateString(formData.dariTanggal)}
                  placeholder={formType === 'WEBSITE' ? 'Kosongkan jika permanen' : 'Maksimal 12 bulan (wajib)'}
                  triggerClassName={cn('h-10 bg-background', !isDurationValid && 'border-destructive/60')}
                />
              </div>
            </div>

            {!isDurationValid && (
              <p className="text-[11px] font-medium text-destructive">
                {formType !== 'WEBSITE'
                  ? 'Masa berlaku akses wajib diisi dan maksimal 12 bulan (1 tahun).'
                  : 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.'}
              </p>
            )}
          </div>


          {/* Detail Kebutuhan Akses */}
          <div className="space-y-3 pt-1 border-t border-border/60">
            {/* Khusus VPN: Dropdown 2 Pilihan */}
            {formType === 'VPN' && (
              <div className="space-y-1.5 pt-2">
                <label id="vpn-need-label" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Kebutuhan Akses VPN <span className="text-destructive">*</span>
                </label>
                <Popover open={vpnDropdownOpen} onOpenChange={setVpnDropdownOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-labelledby="vpn-need-label"
                      aria-expanded={vpnDropdownOpen}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <selectedVpnOption.icon size={18} className="text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{selectedVpnOption.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{selectedVpnOption.description}</p>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1.5 rounded-xl border border-border/80 bg-popover shadow-xl space-y-1 z-50">
                    {VPN_NEED_OPTIONS.map((opt) => {
                      const isSelected = formData.kebutuhanAkses === opt.id;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, kebutuhanAkses: opt.id }));
                            setVpnDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer',
                            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon size={16} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                            <div>
                              <p className="font-semibold text-sm">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.description}</p>
                            </div>
                          </div>
                          {isSelected && <Check size={16} className="text-primary shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Akses Website */}
            {formType === 'WEBSITE' && (
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Website / Domain yang Diminta <span className="text-destructive">*</span>
                </label>
                <Input
                  value={requestedWebsites}
                  onChange={e => setRequestedWebsites(e.target.value)}
                  placeholder="Contoh: github.com, figma.com, stackoverflow.com"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
            )}

            {/* Akses Jaringan */}
            {formType === 'NETWORK' && (
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tujuan / Target Jaringan <span className="text-destructive">*</span>
                </label>
                <Input
                  value={networkPurpose}
                  onChange={e => setNetworkPurpose(e.target.value)}
                  placeholder="Contoh: Akses subnet 192.168.1.0/24 atau file server data"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
            )}

            {/* Alasan Pengajuan */}
            <div className="space-y-2 pt-2">
              <label htmlFor="reason" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Alasan Pengajuan <span className="text-destructive">*</span>
              </label>

              {/* Dynamic Contextual Templates */}
              <div className="flex flex-wrap gap-1.5">
                {activeTemplates.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, alasan: tmpl }))}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors cursor-pointer text-left"
                  >
                    + {tmpl}
                  </button>
                ))}
              </div>

              <textarea
                id="reason"
                value={formData.alasan}
                onChange={e => setFormData(prev => ({ ...prev, alasan: e.target.value }))}
                placeholder="Tuliskan alasan keperluan pengajuan akses ini…"
                className="min-h-[85px] w-full resize-none rounded-xl border border-border/80 bg-background p-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
              />
            </div>
          </div>

          {/* Otorisasi & Tanda Tangan */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Otorisasi &amp; Persetujuan
            </label>

            {/* Atasan Penyetuju */}
            <ManagerSelector selectedId={managerId} onSelect={setManagerId} currentUserId={user?.id} />

            {/* Syarat & Ketentuan */}
            {termsLoading ? (
              <div className="h-32 animate-pulse rounded-xl bg-muted" />
            ) : (
              <TermsAndConditions
                formType={formType}
                accepted={termsAccepted}
                onAccept={setTermsAccepted}
                content={termsData?.terms || ''}
              />

            )}

            {/* Tanda Tangan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Tanda Tangan Pemohon <span className="text-destructive">*</span></span>
                {signatureData && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} /> Terkunci
                  </span>
                )}
              </div>
              <SignaturePad signerName={requesterName} onSave={setSignatureData} />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!isValid || createMutation.isPending}
              className="h-11 w-full rounded-xl text-sm font-bold shadow-xs cursor-pointer"
            >
              {createMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim…</>
              ) : (
                <>Kirim Pengajuan <Send className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            {!isValid && (
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                Lengkapi semua field bertanda bintang (*) dan kunci tanda tangan untuk mengirim.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EformAccessCreatePage;


