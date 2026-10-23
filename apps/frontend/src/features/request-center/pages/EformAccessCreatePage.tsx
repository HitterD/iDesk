import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  Infinity as InfinityIcon,
  Usb,
  Eye,
  FileEdit,
  Clock,
  AlertCircle,
  Sparkles,
  Mail,
  HardDrive,
  UserPlus,
  FolderPlus,
  Info,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { SignaturePad } from '../components/eform/SignaturePad';
import { ManagerSelector } from '../components/eform/ManagerSelector';
import { DepartmentSelector } from '../components/eform/DepartmentSelector';
import { TermsAndConditions } from '../components/eform/TermsAndConditions';
import { EFORM_TYPES, getTypeConfig, SynologyAccountStatus } from '../components/eform/eform-vocabulary';
import { SynologyNasSelector } from '../components/eform/SynologyNasSelector';
import { useCreateEformRequest, useVpnTerms, useEformDetail, NasFolderRequestItem } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type FormType = 'VPN' | 'WEBSITE' | 'NETWORK' | 'FLASHDISK' | 'EMAIL' | 'SYNOLOGY_NAS';

// Contextual config & character image per access type
const MASCOT_CONFIG_BY_TYPE: Record<FormType, {
  image: string;
  alt: string;
  title: string;
  badge: string;
  hint: string;
  hasCharacter: boolean;
}> = {
  VPN: {
    image: '/characters/mascot-shield.png',
    alt: 'Maskot Perisai VPN',
    badge: 'Petugas Keamanan VPN',
    title: 'Akses Remote & WFH',
    hint: 'Gunakan VPN untuk koneksi aman ke komputer kerja atau database internal dari luar kantor. Masa berlaku maksimal 12 bulan.',
    hasCharacter: true,
  },
  WEBSITE: {
    image: '/characters/mascot-webdev.png',
    alt: 'Maskot Akses Website',
    badge: 'Petugas Whitelist Web',
    title: 'Whitelist Situs Kerja',
    hint: 'Pengajuan buka akses situs resmi vendor atau referensi pekerjaan. Bisa dipilih permanen jika merupakan portal resmi perusahaan.',
    hasCharacter: true,
  },
  NETWORK: {
    image: '/characters/mascot-router.png',
    alt: 'Maskot Jaringan & Router',
    badge: 'Petugas Jaringan Kantor',
    title: 'Koneksi Subnet Kantor',
    hint: 'Pastikan target subnet IP atau file server tujuan sudah tepat agar routing firewall tim ICT dapat segera diproses.',
    hasCharacter: true,
  },
  FLASHDISK: {
    image: '/characters/mascot-flashdisk.png',
    alt: 'Maskot Flashdisk USB',
    badge: 'Petugas Port Flashdisk',
    title: 'Izin Port Flashdisk PC',
    hint: 'Pastikan hostname PC kerja sesuai. Pilih opsi Read-Only bila hanya perlu menyalin file dari flashdisk ke komputer.',
    hasCharacter: true,
  },
  EMAIL: {
    image: '/characters/mascot-mail.png',
    alt: 'Maskot Email Kapal Api',
    badge: 'Layanan Email Perusahaan',
    title: 'Pembuatan Akun Email',
    hint: 'Pengajuan email dinas resmi @kapalapi.co.id. Format penamaan contohnya budi.santoso untuk perorangan/karyawan, atau admin.ict jika untuk sharing departemen. Pembuatan mailbox final diproses ICT.',
    hasCharacter: true,
  },
  SYNOLOGY_NAS: {
    image: '/characters/mascot-synology.png',
    alt: 'Maskot Synology NAS',
    badge: 'Layanan File Server & NAS',
    title: 'Akses Shared Folder NAS',
    hint: 'Pilih satu atau lebih server Synology (JKT, KRW, SMG, SPJ) dan centang folder yang diajukan. Hak akses (Read Only / Read & Write) dapat diatur per folder.',
    hasCharacter: true,
  },
};

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
  FLASHDISK: [
    'Transfer data file berukuran besar antar PC/mesin offline',
    'Instalasi software/update driver dari vendor resmi',
    'Backup data kearsipan lokal pekerjaan',
    'Kebutuhan audit/pemeriksaan data eksternal',
  ],
  EMAIL: [
    'Karyawan baru membutuhkan akun email dinas resmi',
    'Kebutuhan komunikasi dan korespondensi resmi dengan pihak eksternal',
    'Akun email sharing untuk operasional divisi / departemen',
    'Penggantian / migrasi akun email dinas sebelumnya',
  ],
  SYNOLOGY_NAS: [
    'Akses file sharing dan dokumen kerja kolaboratif antar divisi',
    'Penyimpanan arsip data pekerjaan dan dokumentasi proyek tim',
    'Integrasi pertukaran berkas ukuran besar di jaringan lokal kantor',
    'Akses repositori terpusat departemen pada server Synology',
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

  const [searchParams] = useSearchParams();
  const renewFrom = searchParams.get('renewFrom');
  const { data: sourceRequest } = useEformDetail(renewFrom || '');
  const hasPrefilledRef = useRef(false);

  const [formType, setFormType] = useState<FormType>('VPN');
  const [requesterName, setRequesterName] = useState(user?.fullName || '');
  const [requesterDepartment, setRequesterDepartment] = useState('');
  const [formData, setFormData] = useState({
    kebutuhanAkses: 'Remote PC Kantor',
    alasan: '',
    dariTanggal: new Date().toISOString().split('T')[0],
    sampaiTanggal: '',
  });
  const [requestedWebsites, setRequestedWebsites] = useState('');
  const [networkPurpose, setNetworkPurpose] = useState('');
  const [hostname, setHostname] = useState('');
  const [accessLevel, setAccessLevel] = useState<'READ_ONLY' | 'READ_WRITE'>('READ_ONLY');
  const [flashdiskInfo, setFlashdiskInfo] = useState('');
  // States for EMAIL & SYNOLOGY_NAS
  const [proposedEmail, setProposedEmail] = useState('');
  const [emailAccountType, setEmailAccountType] = useState<'PERSONAL' | 'SHARING'>('PERSONAL');
  const [folderPath, setFolderPath] = useState('');
  const [nasAccessLevel, setNasAccessLevel] = useState<'READ_ONLY' | 'READ_WRITE'>('READ_ONLY');
  const [selectedNasServers, setSelectedNasServers] = useState<Array<'JKT' | 'KRW' | 'SMG' | 'SPJ'>>(['SPJ']);
  const [nasSelections, setNasSelections] = useState<NasFolderRequestItem[]>([]);
  const [folderScreenshots, setFolderScreenshots] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [managerId, setManagerId] = useState('');
  const [vpnDropdownOpen, setVpnDropdownOpen] = useState(false);
  const [synologyAccountStatus, setSynologyAccountStatus] = useState<SynologyAccountStatus>(
    SynologyAccountStatus.NEW_ACCOUNT
  );
  const [synologyAccountName, setSynologyAccountName] = useState(() => {
    if (user?.email) return user.email.split("@")[0];
    if (user?.fullName) return user.fullName.toLowerCase().replace(/[^a-z0-9]/g, ".");
    return "";
  });

  useEffect(() => {
    if (!synologyAccountName && (user?.email || user?.fullName)) {
      const candidate = user.email
        ? user.email.split("@")[0]
        : (user.fullName ? user.fullName.toLowerCase().replace(/[^a-z0-9]/g, ".") : "");
      if (candidate) {
        setSynologyAccountName(candidate);
      }
    }
  }, [user?.email, user?.fullName, synologyAccountName]);

  const createMutation = useCreateEformRequest();
  const { data: termsData, isLoading: termsLoading } = useVpnTerms();

  // Fetch user profile to get populated department relation
  const { data: userProfile } = useQuery<{
    id: string;
    fullName?: string;
    department?: { id: string; name: string; code?: string };
    departmentId?: string;
  }>({
    queryKey: ['my-profile'],
    queryFn: async () => {
      try {
        const res = await api.get('/users/me');
        return res.data;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const { data: remoteDepartments = [] } = useQuery<Array<{ id: string; name: string; code?: string }>>({
    queryKey: ['departments'],
    queryFn: async () => {
      try {
        const res = await api.get('/departments');
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
  });

  const hasUserManuallySelectedDeptRef = useRef(false);

  const handleDepartmentChange = (deptName: string) => {
    hasUserManuallySelectedDeptRef.current = true;
    setRequesterDepartment(deptName);
  };

  // Auto-fill requester name if empty
  useEffect(() => {
    if (!requesterName && (userProfile?.fullName || user?.fullName)) {
      setRequesterName(userProfile?.fullName || user?.fullName || '');
    }
  }, [userProfile, user, requesterName]);

  // Auto-fill department based on user profile or department lookup
  useEffect(() => {
    if (hasUserManuallySelectedDeptRef.current) return;

    if (userProfile?.department?.name) {
      setRequesterDepartment(userProfile.department.name);
      return;
    }

    const deptId = userProfile?.departmentId || user?.departmentId;
    if (deptId) {
      const matched = remoteDepartments.find(
        d => d.id === deptId || d.code?.toLowerCase() === deptId.toLowerCase() || d.name.toLowerCase() === deptId.toLowerCase()
      );
      if (matched) {
        setRequesterDepartment(matched.name);
        return;
      }

      // If deptId is not a UUID, it's already a plain department name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deptId);
      if (!isUuid && deptId.trim() && !requesterDepartment) {
        setRequesterDepartment(deptId.trim());
      }
    }
  }, [userProfile, remoteDepartments, user?.departmentId]);

  // Handle prefill from renewal
  useEffect(() => {
    if (sourceRequest && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true;
      if (['VPN', 'WEBSITE', 'NETWORK', 'FLASHDISK', 'EMAIL', 'SYNOLOGY_NAS'].includes(sourceRequest.formType)) {
        setFormType(sourceRequest.formType as FormType);
      }

      if (sourceRequest.requesterDepartment) {
        setRequesterDepartment(sourceRequest.requesterDepartment);
        hasUserManuallySelectedDeptRef.current = true;
      }

      const idSnippet = sourceRequest.id.slice(0, 8).toUpperCase();
      const renewReason = `Perpanjangan akses ${sourceRequest.formType} dari pengajuan sebelumnya (#${idSnippet})`;

      const todayStr = new Date().toISOString().split('T')[0];
      let newDariTanggal = todayStr;
      if (sourceRequest.formData?.sampaiTanggal && sourceRequest.formData.sampaiTanggal > todayStr) {
        newDariTanggal = sourceRequest.formData.sampaiTanggal;
      }

      let newSampaiTanggal = '';
      const isPermanentSource = ['WEBSITE', 'EMAIL', 'SYNOLOGY_NAS'].includes(sourceRequest.formType);
      if (!isPermanentSource) {
        const start = parseDateString(newDariTanggal) || new Date();
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        newSampaiTanggal = formatDateToString(end);
      }

      setFormData(prev => ({
        ...prev,
        kebutuhanAkses: sourceRequest.formData?.kebutuhanAkses || prev.kebutuhanAkses,
        alasan: renewReason,
        dariTanggal: newDariTanggal,
        sampaiTanggal: newSampaiTanggal,
      }));

      if (sourceRequest.requestedWebsites) {
        setRequestedWebsites(sourceRequest.requestedWebsites);
      }
      if (sourceRequest.networkPurpose) {
        setNetworkPurpose(sourceRequest.networkPurpose);
      }
      if (sourceRequest.formData?.hostname) {
        setHostname(sourceRequest.formData.hostname);
      }
      if (sourceRequest.formData?.accessLevel) {
        if (sourceRequest.formType === 'SYNOLOGY_NAS') {
          setNasAccessLevel(sourceRequest.formData.accessLevel);
        } else {
          setAccessLevel(sourceRequest.formData.accessLevel);
        }
      }
      if (sourceRequest.formData?.flashdiskInfo) {
        setFlashdiskInfo(sourceRequest.formData.flashdiskInfo);
      }
      if (sourceRequest.formData?.proposedEmail) {
        setProposedEmail(sourceRequest.formData.proposedEmail);
      }
      if (sourceRequest.formData?.accountType) {
        setEmailAccountType(sourceRequest.formData.accountType);
      }
      if (sourceRequest.formData?.folderPath) {
        setFolderPath(sourceRequest.formData.folderPath);
      }
      if (Array.isArray(sourceRequest.formData?.nasSelections)) {
        setNasSelections(sourceRequest.formData.nasSelections);
      }
      if (Array.isArray(sourceRequest.formData?.screenshots)) {
        setFolderScreenshots(sourceRequest.formData.screenshots);
      }

      toast.info(`Memuat data pengajuan sebelumnya (#${idSnippet}) untuk perpanjangan akses`);
    }
  }, [sourceRequest]);

  const isPermanentAllowed = formType === 'WEBSITE' || formType === 'EMAIL' || formType === 'SYNOLOGY_NAS';

  // Max 12 months validation helper (applicable only to non-permanent types)
  const isDurationValid = useMemo(() => {
    if (isPermanentAllowed && !formData.sampaiTanggal) return true; // Website, Email, and NAS can be permanent
    if (!formData.sampaiTanggal) return false; // VPN, Network, and Flashdisk must have end date
    const start = parseDateString(formData.dariTanggal);
    const end = parseDateString(formData.sampaiTanggal);
    if (!start || !end) return false;
    if (end < start) return false;
    if (!isPermanentAllowed) {
      // Difference in days (366 days max for 1 year)
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 366;
    }
    return true;
  }, [formType, formData.dariTanggal, formData.sampaiTanggal, isPermanentAllowed]);

  const isValid =
    !!requesterName.trim() &&
    !!requesterDepartment.trim() &&
    !!formData.alasan.trim() &&
    !!formData.dariTanggal &&
    isDurationValid &&
    termsAccepted &&
    !!signatureData &&
    !!managerId &&
    (formType !== 'WEBSITE' || !!requestedWebsites.trim()) &&
    (formType !== 'NETWORK' || !!networkPurpose.trim()) &&
    (formType !== 'FLASHDISK' || !!hostname.trim()) &&
    (formType !== 'EMAIL' || !!proposedEmail.trim()) &&
    (formType !== 'SYNOLOGY_NAS' || nasSelections.length > 0 || folderScreenshots.length > 0 || !!folderPath.trim());

  // Handle access type switch with duration adaptation
  const handleFormTypeChange = (newType: FormType) => {
    setFormType(newType);
    const newIsPermanentAllowed = newType === 'WEBSITE' || newType === 'EMAIL' || newType === 'SYNOLOGY_NAS';
    if (!newIsPermanentAllowed && !formData.sampaiTanggal) {
      // Default to 12 months for VPN / Network / Flashdisk if it was permanent
      const start = parseDateString(formData.dariTanggal) || new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(end) }));
    }
  };

  // Duration preset handlers
  const handleSetDurationDays = (days: number) => {
    const start = parseDateString(formData.dariTanggal) || new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(end) }));
  };

  const handleSetDurationPreset = (months: number) => {
    const start = parseDateString(formData.dariTanggal) || new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(end) }));
  };

  const handleSetPermanent = () => {
    if (!isPermanentAllowed) {
      toast.warning('Akses selain Website, Email, dan Synology NAS maksimal 12 bulan (1 tahun)');
      return;
    }
    setFormData(prev => ({ ...prev, sampaiTanggal: '' }));
  };


  const handleSubmit = async () => {
    if (!isValid) {
      if (!requesterDepartment.trim()) {
        toast.error('Pilih atau isi nama departemen terlebih dahulu');
        return;
      }
      toast.error('Lengkapi semua field yang wajib diisi');
      return;
    }
    try {
      const finalFormData = {
        ...formData,
        ...(formType === 'FLASHDISK'
          ? {
              hostname: hostname.trim(),
              accessLevel,
              flashdiskInfo: flashdiskInfo.trim(),
            }
          : {}),
        ...(formType === 'EMAIL'
          ? {
              proposedEmail: proposedEmail.trim(),
              emailDomain: '@kapalapi.co.id',
              accountType: emailAccountType,
            }
          : {}),
        ...(formType === 'SYNOLOGY_NAS'
          ? {
              nasSelections,
              screenshots: folderScreenshots,
              folderPath:
                nasSelections.length > 0
                  ? nasSelections.map(s => `${s.nasId}: ${s.folderPath}`).join(', ')
                  : (folderScreenshots.length > 0 ? `${folderScreenshots.length} Screenshot Folder Dilampirkan` : folderPath.trim()),
              accessLevel: nasSelections.some(s => s.accessLevel === 'READ_WRITE')
                ? 'READ_WRITE'
                : nasAccessLevel,
              accountType: 'SHARING',
            }
          : {}),
      };
      const result = await createMutation.mutateAsync({
        formType,
        requesterName,
        requesterDepartment,
        formData: finalFormData,
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
  const activeMascotConfig = MASCOT_CONFIG_BY_TYPE[formType];

  return (
    <div className="mx-auto max-w-[1480px] w-full pt-1 pb-8 space-y-6">
      {/* Top Bar: Back Button & Context Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="rounded-xl font-medium h-9 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali
        </Button>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">iDesk Access Request</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Ajukan Akses</h1>
        <p className="text-sm text-muted-foreground">{selectedType.description}</p>
      </div>

      {/* Split Bento Grid: Left Main Form + Right Sticky Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (8 cols): Main Form Bento Cards */}
        <div className="lg:col-span-8 space-y-6">
          {/* Renewal Banner */}
          {renewFrom && sourceRequest && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-foreground shadow-xs">
              <FileEdit className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-primary">Mode Perpanjangan Akses:</span> Formulir telah diisi otomatis berdasarkan pengajuan sebelumnya{' '}
                <span className="font-mono font-bold">#{sourceRequest.id.slice(0, 8).toUpperCase()}</span> ({getTypeConfig(sourceRequest.formType).label}).
                Silakan sesuaikan masa berlaku dan tanda tangani kembali pengajuan ini.
              </div>
            </div>
          )}

          {/* Bento Card 1: Jenis Akses */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Jenis Akses</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-medium">Pilih layanan yang diajukan</span>
            </div>

            {/* Baris 1: Koneksi & Perangkat Kantor */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                Konektivitas &amp; Perangkat Kantor
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {EFORM_TYPES.filter(t => ['VPN', 'WEBSITE', 'NETWORK', 'FLASHDISK'].includes(t.id)).map(({ id, label, icon: TypeIcon }) => {
                  const isActive = formType === id;
                  const mascot = MASCOT_CONFIG_BY_TYPE[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleFormTypeChange(id)}
                      className={cn(
                        'group flex items-center justify-center gap-2 py-3 px-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer min-h-[46px] select-none text-center',
                        isActive
                          ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                          : 'border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40'
                      )}
                    >
                      {mascot?.image ? (
                        <img
                          src={mascot.image}
                          alt=""
                          className={cn(
                            'w-5 h-5 object-contain shrink-0 transition-transform duration-200 group-hover:scale-110',
                            isActive ? 'scale-105' : 'opacity-80'
                          )}
                        />
                      ) : (
                        <TypeIcon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                            isActive ? 'text-primary scale-105' : 'text-muted-foreground'
                          )}
                        />
                      )}
                      <span className="font-semibold whitespace-nowrap text-xs">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Baris 2: Akun Dinas & Penyimpanan Data (Ditaruh di Bawah) */}
            <div className="space-y-1.5 pt-2.5 border-t border-border/60">
              <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                Akun Dinas &amp; Penyimpanan Data
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EFORM_TYPES.filter(t => ['EMAIL', 'SYNOLOGY_NAS'].includes(t.id)).map(({ id, label, icon: TypeIcon }) => {
                  const isActive = formType === id;
                  const mascot = MASCOT_CONFIG_BY_TYPE[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleFormTypeChange(id)}
                      className={cn(
                        'group flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer min-h-[46px] select-none text-center',
                        isActive
                          ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                          : 'border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40'
                      )}
                    >
                      {mascot?.image ? (
                        <img
                          src={mascot.image}
                          alt=""
                          className={cn(
                            'w-5 h-5 object-contain shrink-0 transition-transform duration-200 group-hover:scale-110',
                            isActive ? 'scale-105' : 'opacity-80'
                          )}
                        />
                      ) : (
                        <TypeIcon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                            isActive ? 'text-primary scale-105' : 'text-muted-foreground'
                          )}
                        />
                      )}
                      <span className="font-semibold whitespace-nowrap text-xs">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">{selectedType.description}</p>
          </div>

          {/* Bento Card 2: Identitas & Periode Akses */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
            {/* Identitas Pemohon */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Identitas Pemohon</span>
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
                  <span className="text-xs font-medium text-muted-foreground">Departemen <span className="text-destructive">*</span></span>
                  <DepartmentSelector
                    value={requesterDepartment}
                    onChange={handleDepartmentChange}
                  />
                </div>
              </div>
            </div>

            {/* Periode Akses */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Periode Akses</span> {!isPermanentAllowed && <span className="text-[10px] font-normal lowercase text-muted-foreground">(maks. 12 bulan)</span>}
                </label>
                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {formType === 'FLASHDISK' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSetDurationDays(1)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        +1 Hari
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetDurationDays(7)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        +1 Minggu
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSetDurationPreset(1)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    +1 Bln
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDurationPreset(3)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    +3 Bln
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDurationPreset(6)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    +6 Bln
                  </button>
                  {isPermanentAllowed ? (
                    <button
                      type="button"
                      onClick={handleSetPermanent}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer",
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
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                    Sampai Tanggal {isPermanentAllowed ? '(Opsional)' : <span className="text-destructive">*</span>}
                  </span>
                  <ModernDatePicker
                    value={parseDateString(formData.sampaiTanggal)}
                    onChange={date => setFormData(prev => ({ ...prev, sampaiTanggal: formatDateToString(date) }))}
                    minDate={parseDateString(formData.dariTanggal)}
                    placeholder={isPermanentAllowed ? 'Kosongkan jika permanen' : 'Maksimal 12 bulan (wajib)'}
                    triggerClassName={cn('h-10 bg-background', !isDurationValid && 'border-destructive/60')}
                  />
                </div>
              </div>

              {!isDurationValid && (
                <p className="text-[11px] font-medium text-destructive">
                  {!isPermanentAllowed
                    ? 'Masa berlaku akses wajib diisi dan maksimal 12 bulan (1 tahun).'
                    : 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.'}
                </p>
              )}
            </div>
          </div>

          {/* Bento Card 3: Detail Kebutuhan Akses & Alasan */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
            {/* Khusus VPN: Dropdown 2 Pilihan */}
            {formType === 'VPN' && (
              <div className="space-y-1.5">
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
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[48px]"
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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

            {/* Akses Flashdisk */}
            {formType === 'FLASHDISK' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Nama Komputer / Hostname PC <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={hostname}
                    onChange={e => setHostname(e.target.value)}
                    placeholder="Contoh: PC-ACC-01 atau NB-MKT-04"
                    className="h-10 rounded-xl bg-background font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sebutkan hostname komputer kerja tempat flashdisk akan ditancapkan.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tipe Akses USB <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAccessLevel('READ_ONLY')}
                      className={cn(
                        'flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer',
                        accessLevel === 'READ_ONLY'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1.5',
                          accessLevel === 'READ_ONLY' ? 'text-primary' : 'text-foreground'
                        )}>
                          <Eye size={15} /> Read Only (Hanya Baca)
                        </span>
                        {accessLevel === 'READ_ONLY' && (
                          <CheckCircle2 size={15} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hanya membaca data dari Flashdisk ke PC. Tidak dapat menyimpan atau menyalin file ke Flashdisk.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessLevel('READ_WRITE')}
                      className={cn(
                        'flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer',
                        accessLevel === 'READ_WRITE'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1.5',
                          accessLevel === 'READ_WRITE' ? 'text-primary' : 'text-foreground'
                        )}>
                          <FileEdit size={15} /> Read &amp; Write (Baca &amp; Tulis)
                        </span>
                        {accessLevel === 'READ_WRITE' && (
                          <CheckCircle2 size={15} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Dapat membaca dan menulis/menyalin data bolak-balik antara PC dan Flashdisk.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Keterangan Flashdisk <span className="text-[11px] font-normal lowercase text-muted-foreground">(opsional)</span>
                  </label>
                  <Input
                    value={flashdiskInfo}
                    onChange={e => setFlashdiskInfo(e.target.value)}
                    placeholder="Contoh: SanDisk Cruzer Blade 32GB (S/N: 48921)"
                    className="h-10 rounded-xl bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sebutkan merk, kapasitas, atau serial number jika sudah ada perangkat spesifik.
                  </p>
                </div>
              </div>
            )}

            {/* Request New Email */}
            {formType === 'EMAIL' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Usulan Nama Email <span className="text-destructive">*</span>
                    </label>
                    {proposedEmail && (
                      <span className="text-[11px] font-mono text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-md">
                        Preview: {proposedEmail}@kapalapi.co.id
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={proposedEmail}
                        onChange={e => setProposedEmail(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                        placeholder={
                          emailAccountType === 'PERSONAL'
                            ? 'Contoh: budi.santoso'
                            : 'Contoh: admin.ict'
                        }
                        className="h-10 rounded-xl bg-background font-mono text-sm pr-3"
                      />
                    </div>
                    <span className="px-3 py-2 text-xs font-bold font-mono rounded-xl bg-muted border border-border/80 text-foreground shrink-0 select-none">
                      @kapalapi.co.id
                    </span>
                  </div>

                  {/* Tombol Contoh Penamaan Cepat */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-muted-foreground font-medium">Contoh format:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailAccountType('PERSONAL');
                        setProposedEmail('budi.santoso');
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer',
                        proposedEmail === 'budi.santoso' && emailAccountType === 'PERSONAL'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border/80 bg-muted/40 hover:bg-muted text-foreground'
                      )}
                      title="Gunakan contoh nama email perorangan"
                    >
                      <User size={12} className="text-muted-foreground" />
                      <span>budi.santoso</span>
                      <span className="text-[10px] text-muted-foreground font-sans font-normal">(Personal)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEmailAccountType('SHARING');
                        setProposedEmail('admin.ict');
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer',
                        proposedEmail === 'admin.ict' && emailAccountType === 'SHARING'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border/80 bg-muted/40 hover:bg-muted text-foreground'
                      )}
                      title="Gunakan contoh nama email sharing departemen"
                    >
                      <Network size={12} className="text-muted-foreground" />
                      <span>admin.ict</span>
                      <span className="text-[10px] text-muted-foreground font-sans font-normal">(Sharing)</span>
                    </button>
                  </div>

                  {/* Panduan Format Penamaan Resmi */}
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
                      <Sparkles size={13} className="text-primary" />
                      <span>Pedoman Format Nama Akun Email:</span>
                    </div>
                    <ul className="space-y-1 text-[11px] leading-relaxed">
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>
                          <strong>Akun Personal / Karyawan:</strong> Gunakan nama lengkap tanpa spasi dipisahkan titik, contoh: <code className="font-mono text-foreground font-semibold bg-background px-1 py-0.5 rounded border border-border/60">budi.santoso</code> (menghasilkan <span className="font-mono text-primary font-medium">budi.santoso@kapalapi.co.id</span>).
                        </span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>
                          <strong>Akun Sharing / Departemen:</strong> Gunakan peran atau fungsi divisi, contoh: <code className="font-mono text-foreground font-semibold bg-background px-1 py-0.5 rounded border border-border/60">admin.ict</code> (menjadi <span className="font-mono text-primary font-medium">admin.ict@kapalapi.co.id</span>).
                        </span>
                      </li>
                    </ul>
                    <p className="text-[10px] text-muted-foreground/80 pt-0.5 border-t border-border/40">
                      * Alamat email final dan konfigurasi mailbox resmi akan disesuaikan serta diterbitkan oleh Tim ICT.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tipe Akun Email <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEmailAccountType('PERSONAL')}
                      className={cn(
                        'flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                        emailAccountType === 'PERSONAL'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1.5',
                          emailAccountType === 'PERSONAL' ? 'text-primary' : 'text-foreground'
                        )}>
                          <User size={15} /> Personal / Karyawan
                        </span>
                        {emailAccountType === 'PERSONAL' && (
                          <CheckCircle2 size={15} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Akun dinas perorangan (contoh: <strong className="font-mono text-foreground">budi.santoso@kapalapi.co.id</strong>).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailAccountType('SHARING')}
                      className={cn(
                        'flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                        emailAccountType === 'SHARING'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1.5',
                          emailAccountType === 'SHARING' ? 'text-primary' : 'text-foreground'
                        )}>
                          <Network size={15} /> Sharing / Departemen
                        </span>
                        {emailAccountType === 'SHARING' && (
                          <CheckCircle2 size={15} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Shared mailbox divisi/tim (contoh: <strong className="font-mono text-foreground">admin.ict@kapalapi.co.id</strong>).
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Request Synology NAS */}
            {formType === 'SYNOLOGY_NAS' && (
              <div className="space-y-4">
                {/* Status Kepemilikan Akun Synology NAS */}
                <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Status Akun Synology <span className="text-destructive">*</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Tentukan apakah permohonan ini untuk pembuatan akun baru atau penambahan hak folder pada akun yang sudah dimiliki.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSynologyAccountStatus(SynologyAccountStatus.NEW_ACCOUNT)}
                      className={cn(
                        'flex flex-col items-start p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                        synologyAccountStatus === SynologyAccountStatus.NEW_ACCOUNT
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1.5',
                          synologyAccountStatus === SynologyAccountStatus.NEW_ACCOUNT ? 'text-primary' : 'text-foreground'
                        )}>
                          <UserPlus size={16} /> Belum Memiliki Akun
                        </span>
                        {synologyAccountStatus === SynologyAccountStatus.NEW_ACCOUNT && (
                          <CheckCircle2 size={16} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        Dibuatkan akun login Synology baru sekaligus disiapkan hak akses folder yang dipilih.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSynologyAccountStatus(SynologyAccountStatus.EXISTING_ACCOUNT)}
                      className={cn(
                        'flex flex-col items-start p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer relative',
                        synologyAccountStatus === SynologyAccountStatus.EXISTING_ACCOUNT
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1.5',
                          synologyAccountStatus === SynologyAccountStatus.EXISTING_ACCOUNT ? 'text-primary' : 'text-foreground'
                        )}>
                          <FolderPlus size={16} /> Sudah Memiliki Akun
                        </span>
                        {synologyAccountStatus === SynologyAccountStatus.EXISTING_ACCOUNT && (
                          <CheckCircle2 size={16} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        Hanya mengajukan penambahan izin hak akses folder ke akun Synology yang sudah aktif.
                      </p>
                    </button>
                  </div>

                  {/* Form input nama akun bila sudah punya akun */}
                  {synologyAccountStatus === SynologyAccountStatus.EXISTING_ACCOUNT && (
                    <div className="pt-2 animate-fade-in-up space-y-2 border-t border-border/50">
                      <label htmlFor="synologyAccountName" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <span>Nama Akun Synology Anda</span> <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          id="synologyAccountName"
                          type="text"
                          value={synologyAccountName}
                          onChange={e => setSynologyAccountName(e.target.value)}
                          placeholder="Contoh: bagas.pratama"
                          className="h-10 pl-9 rounded-xl border border-border/80 bg-background font-mono text-sm focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
                        />
                        <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-normal">
                        <Info size={13} className="shrink-0 text-primary mt-0.5" />
                        <span>
                          Masukkan nama user/akun yang biasa Anda gunakan saat login ke portal Synology NAS. Akses folder akan ditambahkan langsung ke akun ini.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <SynologyNasSelector
                  selectedServers={selectedNasServers}
                  onSelectedServersChange={setSelectedNasServers}
                  selections={nasSelections}
                  onSelectionsChange={setNasSelections}
                  screenshots={folderScreenshots}
                  onScreenshotsChange={setFolderScreenshots}
                />
              </div>
            )}

            {/* Alasan Pengajuan */}
            <div className="space-y-2.5 pt-3 border-t border-border/60">
              <label htmlFor="reason" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Alasan Pengajuan</span> <span className="text-destructive">*</span>
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
                className="min-h-[90px] w-full resize-none rounded-xl border border-border/80 bg-background p-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
              />
            </div>
          </div>

          {/* Bento Card 4: Otorisasi & Tanda Tangan */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Otorisasi &amp; Persetujuan</span>
            </label>

            {/* Atasan Penyetuju */}
            {formType !== 'SYNOLOGY_NAS' ? (
              <ManagerSelector selectedId={managerId} onSelect={setManagerId} currentUserId={user?.id} />
            ) : (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-foreground">
                    Verifikasi Langsung Tim ICT (Tanpa Persetujuan Atasan)
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Khusus pengajuan hak akses Synology NAS, berkas pengajuan diarahkan langsung ke Tim ICT untuk verifikasi dan realisasi teknis tanpa memerlukan persetujuan atasan.
                  </p>
                </div>
              </div>
            )}

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
        </div>

        {/* Right Column (4 cols): Sticky Sidebar with Mascot & Live Summary */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
          {/* Assistant Guidance Card */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-xs relative overflow-hidden transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                {activeMascotConfig.image ? (
                  <img
                    key={formType}
                    src={activeMascotConfig.image}
                    alt={activeMascotConfig.alt}
                    className="w-20 h-20 sm:w-24 sm:h-24 object-contain filter drop-shadow-sm transition-all duration-300 animate-in fade-in zoom-in-95 hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                    <selectedType.icon className="w-8 h-8 sm:w-9 sm:h-9 text-primary" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
                  <selectedType.icon size={13} />
                  <span>{activeMascotConfig.badge}</span>
                </div>
                <h3 className="font-bold text-sm text-foreground">{activeMascotConfig.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activeMascotConfig.hint}
                </p>
              </div>
            </div>
          </div>

          {/* Live Summary Card */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ringkasan Pengajuan
              </span>
              {isValid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle2 size={13} /> Siap Kirim
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Clock size={13} /> Belum Lengkap
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kategori Akses</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <selectedType.icon size={14} className="text-primary" /> {selectedType.label}
                </span>
              </div>
              {formType === 'SYNOLOGY_NAS' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Server NAS</span>
                    <span className="font-semibold text-foreground text-right truncate max-w-[170px]">
                      {selectedNasServers.join(', ') || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Folder / Bukti</span>
                    <span className={cn('font-semibold text-right text-xs', (nasSelections.length > 0 || folderScreenshots.length > 0) ? 'text-primary' : 'text-amber-500')}>
                      {nasSelections.length > 0 && `${nasSelections.length} folder`}
                      {nasSelections.length > 0 && folderScreenshots.length > 0 && ', '}
                      {folderScreenshots.length > 0 && `${folderScreenshots.length} screenshot`}
                      {nasSelections.length === 0 && folderScreenshots.length === 0 && 'Belum diisi'}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pemohon</span>
                <span className="font-semibold text-foreground truncate max-w-[170px]">
                  {requesterName || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Departemen</span>
                {requesterDepartment ? (
                  <span className="font-medium text-foreground truncate max-w-[170px]">
                    {requesterDepartment}
                  </span>
                ) : (
                  <span className="text-amber-500 font-medium text-xs">
                    Belum Dipilih
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Masa Berlaku</span>
                <span className="font-semibold text-foreground text-right truncate max-w-[170px]">
                  {isPermanentAllowed && !formData.sampaiTanggal
                    ? 'Permanen'
                    : formData.dariTanggal && formData.sampaiTanggal
                      ? `${formatDateIndonesian(formData.dariTanggal)} – ${formatDateIndonesian(formData.sampaiTanggal)}`
                      : formData.dariTanggal
                        ? `Mulai ${formatDateIndonesian(formData.dariTanggal)}`
                        : '—'}
                </span>
              </div>
              {formType === 'SYNOLOGY_NAS' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status Akun</span>
                    <span className="font-semibold text-foreground text-right truncate max-w-[170px]">
                      {synologyAccountStatus === SynologyAccountStatus.EXISTING_ACCOUNT
                        ? `Akun Ada (${synologyAccountName || '—'})`
                        : 'Akun Baru'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Alur Verifikasi</span>
                    <span className="font-medium text-primary text-right">
                      Direct ke Tim ICT
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Atasan Penyetuju</span>
                  <span className={cn('font-medium', managerId ? 'text-emerald-600' : 'text-muted-foreground')}>
                    {managerId ? 'Sudah Dipilih' : 'Belum Dipilih'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Syarat &amp; Ketentuan</span>
                <span className={cn('font-medium', termsAccepted ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {termsAccepted ? 'Disetujui' : 'Belum Disetujui'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tanda Tangan</span>
                <span className={cn('font-medium', signatureData ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {signatureData ? 'Terkunci' : 'Belum Ada'}
                </span>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-3 border-t border-border/60">
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
                <p className="text-center text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  Lengkapi semua field bertanda bintang (*) dan kunci tanda tangan untuk mengirim.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EformAccessCreatePage;


