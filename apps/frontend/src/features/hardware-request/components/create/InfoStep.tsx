import { useState, useMemo, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
    Building2,
    Users,
    FileText,
    Check,
    X,
    UserCheck,
    Coins,
    FileCheck2,
    HelpCircle,
    Search,
    ChevronDown,
} from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { useAuth } from '@/stores/useAuth';
import api from '@/lib/api';
import type { CreateFormValues } from './CreateWizard';
import { cn } from '@/lib/utils';

const DEFAULT_DEPARTMENTS = [
    'Information Technology',
    'Human Resources',
    'Finance & Accounting',
    'Sales & Marketing',
    'Operations',
    'General Affairs',
    'Supply Chain & Logistics',
    'Production',
    'Quality Assurance',
    'Purchasing',
];

interface ApproverUser {
    id: string;
    fullName: string;
    jobTitle?: string;
    department?: { id?: string; name: string; code?: string; siteId?: string } | string;
    email?: string;
}

function getDeptName(dept: any): string {
    if (!dept) return '';
    if (typeof dept === 'string') return dept;
    return dept.name || dept.code || '';
}

export function InfoStep() {
    const { user } = useAuth();
    const {
        register,
        watch,
        setValue,
        formState: { errors },
    } = useFormContext<CreateFormValues>();

    const division = watch('division');
    const recipientNames = watch('recipientNames') || [];
    const requestType = watch('requestType') || 'BUDGET_ANNUAL';

    const [userSearch, setUserSearch] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [customRecipient, setCustomRecipient] = useState('');

    // Fetch users for multi-recipient selection
    const { data: usersList = [], isLoading: isLoadingUsers } = useQuery<ApproverUser[]>({
        queryKey: ['users', 'approvers'],
        queryFn: async () => {
            const { data } = await api.get('/users/approvers');
            return Array.isArray(data) ? data : [];
        },
        staleTime: 60_000,
    });

    // Auto-set default division from current user if empty
    useEffect(() => {
        if (!division && user) {
            const userDept = getDeptName((user as any).department) || (user as any).departmentId;
            if (userDept) {
                setValue('division', String(userDept), { shouldValidate: true });
            }
        }
    }, [division, user, setValue]);

    const filteredUsers = useMemo(() => {
        if (!userSearch) return usersList.slice(0, 15);
        return usersList
            .filter((u) => {
                const dept = getDeptName(u.department);
                const title = u.jobTitle || '';
                const email = u.email || '';
                return `${u.fullName} ${email} ${title} ${dept}`
                    .toLowerCase()
                    .includes(userSearch.toLowerCase());
            })
            .slice(0, 15);
    }, [usersList, userSearch]);

    const addRecipient = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (!recipientNames.includes(trimmed)) {
            const next = [...recipientNames, trimmed];
            setValue('recipientNames', next, { shouldValidate: true });
            setValue('recipientName', next.join(', '), { shouldValidate: true });
        }
        setUserSearch('');
        setCustomRecipient('');
        setDropdownOpen(false);
    };

    const removeRecipient = (name: string) => {
        const next = recipientNames.filter((n) => n !== name);
        setValue('recipientNames', next, { shouldValidate: true });
        setValue('recipientName', next.join(', '), { shouldValidate: true });
    };

    const setSelfAsRecipient = () => {
        if (user?.fullName) {
            addRecipient(user.fullName);
        }
    };

    const currentDivisionString = typeof division === 'string' ? division : getDeptName(division);

    return (
        <div className="space-y-5">
            {/* Request Type Selector Banner */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                    <Coins className="size-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Kategori Anggaran Pengajuan
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setValue('requestType', 'BUDGET_ANNUAL')}
                        className={cn(
                            'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                            requestType === 'BUDGET_ANNUAL'
                                ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30'
                                : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        )}
                    >
                        <FileCheck2 className={cn('size-5 shrink-0 mt-0.5', requestType === 'BUDGET_ANNUAL' ? 'text-primary' : 'text-muted-foreground')} />
                        <div>
                            <span className="text-xs sm:text-sm font-bold text-foreground block">
                                Realisasi Budget Tahunan ICT
                            </span>
                            <span className="text-[11px] text-muted-foreground mt-0.5 block leading-relaxed">
                                Pengajuan perangkat keras sesuai alokasi budget tahunan departemen yang telah disetujui.
                            </span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setValue('requestType', 'NON_BUDGET')}
                        className={cn(
                            'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                            requestType === 'NON_BUDGET'
                                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                                : 'bg-card border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground'
                        )}
                    >
                        <HelpCircle className={cn('size-5 shrink-0 mt-0.5', requestType === 'NON_BUDGET' ? 'text-amber-600' : 'text-muted-foreground')} />
                        <div>
                            <span className="text-xs sm:text-sm font-bold text-foreground block">
                                Pengajuan Budget Tambahan / Non-Tahunan
                            </span>
                            <span className="text-[11px] text-muted-foreground mt-0.5 block leading-relaxed">
                                Kebutuhan mendesak atau proyek khusus di luar alokasi budget tahunan rutin.
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Main Information Form Card */}
            <SectionCard title="Informasi Penerima & Justifikasi">
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Divisi Penerima */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Building2 className="size-3.5 text-primary" />
                                <span>Divisi / Departemen Penerima *</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={currentDivisionString || ''}
                                    onChange={(e) => setValue('division', e.target.value, { shouldValidate: true })}
                                    className={cn(
                                        'w-full px-3.5 py-2.5 rounded-xl border bg-card text-foreground text-sm font-medium outline-none transition-all shadow-xs cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary',
                                        errors.division ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-border'
                                    )}
                                >
                                    <option value="">Pilih Departemen / Divisi...</option>
                                    {DEFAULT_DEPARTMENTS.map((dept) => (
                                        <option key={dept} value={dept}>
                                            {dept}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {errors.division && (
                                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
                                    {errors.division.message}
                                </p>
                            )}
                        </div>

                        {/* Nama Penerima (Multi-User Search Dropdown) */}
                        <div className="space-y-2 relative">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Users className="size-3.5 text-primary" />
                                    <span>Nama Penerima Barang</span>
                                </label>
                                {user?.fullName && !recipientNames.includes(user.fullName) && (
                                    <button
                                        type="button"
                                        onClick={setSelfAsRecipient}
                                        className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <UserCheck className="size-3" />
                                        <span>Untuk Saya Sendiri</span>
                                    </button>
                                )}
                            </div>

                            {/* Recipient Tags / Badges */}
                            {recipientNames.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {recipientNames.map((name) => (
                                        <span
                                            key={name}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shadow-2xs"
                                        >
                                            <span>{name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeRecipient(name)}
                                                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                                                aria-label={`Hapus penerima ${name}`}
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Dropdown Input / Trigger */}
                            <div className="relative">
                                <div
                                    onClick={() => setDropdownOpen((o) => !o)}
                                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-border bg-card text-foreground text-sm flex items-center justify-between cursor-pointer shadow-xs hover:border-primary/50 transition-colors"
                                >
                                    <span className="text-muted-foreground text-xs sm:text-sm">
                                        {recipientNames.length === 0
                                            ? 'Pilih atau cari nama penerima (bisa lebih dari satu)...'
                                            : '+ Tambah penerima lain...'}
                                    </span>
                                    <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
                                </div>

                                {dropdownOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-card border border-border rounded-2xl shadow-xl p-3 space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Ketik nama karyawan atau email..."
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-foreground outline-none focus:ring-1 focus:ring-primary"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                            {isLoadingUsers ? (
                                                <p className="text-xs text-muted-foreground p-2">Memuat daftar user...</p>
                                            ) : filteredUsers.length > 0 ? (
                                                filteredUsers.map((u) => {
                                                    const isSelected = recipientNames.includes(u.fullName);
                                                    const dept = getDeptName(u.department);
                                                    const subtitle = [u.jobTitle, dept, u.email].filter(Boolean).join(' · ');
                                                    return (
                                                        <div
                                                            key={u.id}
                                                            onClick={() => (isSelected ? removeRecipient(u.fullName) : addRecipient(u.fullName))}
                                                            className={cn(
                                                                'flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors',
                                                                isSelected
                                                                    ? 'bg-primary/10 text-primary font-bold'
                                                                    : 'hover:bg-muted/60 text-foreground'
                                                            )}
                                                        >
                                                            <div className="min-w-0 pr-2">
                                                                <span className="font-semibold block truncate">{u.fullName}</span>
                                                                {subtitle ? (
                                                                    <span className="text-[10px] text-muted-foreground block truncate">
                                                                        {subtitle}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-xs text-muted-foreground p-2">Tidak ditemukan user.</p>
                                            )}
                                        </div>

                                        {/* Custom name write-in */}
                                        <div className="pt-2 border-t border-border flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Atau ketik nama manual..."
                                                value={customRecipient}
                                                onChange={(e) => setCustomRecipient(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addRecipient(customRecipient);
                                                    }
                                                }}
                                                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/20 text-foreground outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => addRecipient(customRecipient)}
                                                disabled={!customRecipient.trim()}
                                                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 cursor-pointer"
                                            >
                                                Tambah
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground italic">
                                Kosongkan jika perangkat ditujukan untuk diri Anda sendiri atau inventaris divisi.
                            </p>
                        </div>
                    </div>

                    {/* Justifikasi Kebutuhan */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FileText className="size-3.5 text-primary" />
                            <span>Justifikasi Kebutuhan & Keterangan Pengadaan *</span>
                        </label>
                        <textarea
                            {...register('justification')}
                            rows={4}
                            placeholder="Jelaskan kebutuhan pengadaan hardware, peruntukan kerja, nomor alokasi budget, atau detail pendukung lainnya..."
                            className={cn(
                                'w-full px-4 py-3 rounded-xl border bg-card text-foreground text-sm outline-none transition-all shadow-xs focus:ring-2 focus:ring-primary/20 focus:border-primary',
                                errors.justification ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-border'
                            )}
                        />
                        {errors.justification && (
                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
                                {errors.justification.message}
                            </p>
                        )}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
