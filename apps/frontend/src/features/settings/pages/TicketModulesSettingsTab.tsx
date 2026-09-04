import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { TicketModule } from '@/types/ticket.types';
import {
    Plus,
    Edit3,
    Trash2,
    Check,
    X,
    Layers,
    Ticket,
    Database,
    Code2,
    Smartphone,
    Network,
    Server,
    Wifi,
    Shield,
    Cpu,
    Monitor,
    HardDrive,
    Terminal,
    HelpCircle,
    Zap,
    Cloud,
    Lock,
    Settings,
    Radio,
    FileText,
    Boxes,
    ShieldCheck,
    Globe,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { ModuleAssigneePicker } from '@/features/settings/components/ModuleAssigneePicker';

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Ticket,
    Database,
    Code2,
    Smartphone,
    Network,
    Server,
    Wifi,
    Shield,
    Cpu,
    Monitor,
    HardDrive,
    Terminal,
    HelpCircle,
    Zap,
    Cloud,
    Lock,
    Settings,
    Radio,
    FileText,
    Boxes,
    Layers,
    Globe,
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; ring: string }> = {
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800/60',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
        ring: 'ring-blue-500',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800/60',
        badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
        ring: 'ring-purple-500',
    },
    sky: {
        bg: 'bg-sky-50 dark:bg-sky-950/40',
        text: 'text-sky-600 dark:text-sky-400',
        border: 'border-sky-200 dark:border-sky-800/60',
        badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300',
        ring: 'ring-sky-500',
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
        ring: 'ring-emerald-500',
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/60',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
        ring: 'ring-amber-500',
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800/60',
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
        ring: 'ring-rose-500',
    },
    indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        text: 'text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-200 dark:border-indigo-800/60',
        badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
        ring: 'ring-indigo-500',
    },
    teal: {
        bg: 'bg-teal-50 dark:bg-teal-950/40',
        text: 'text-teal-600 dark:text-teal-400',
        border: 'border-teal-200 dark:border-teal-800/60',
        badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300',
        ring: 'ring-teal-500',
    },
    orange: {
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800/60',
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
        ring: 'ring-orange-500',
    },
};

const ALL_ROLES = [
    { value: 'ADMIN', label: 'Admin', color: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800' },
    { value: 'AGENT_ORACLE', label: 'Agent Oracle / Web', color: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800' },
    { value: 'AGENT_MOBILE_DEV', label: 'Agent Mobile Dev', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800' },
    { value: 'AGENT_WEB_DEV', label: 'Agent Web Dev', color: 'bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800' },
    { value: 'AGENT_OPERATIONAL_SUPPORT', label: 'Ops Support', color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
    { value: 'AGENT', label: 'Agent (General)', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800' },
    { value: 'AGENT_ADMIN', label: 'Agent Admin', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800' },
    { value: 'MANAGER', label: 'Manager', color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
    { value: 'USER', label: 'User / Requester', color: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800' },
];

const ALL_HANDLING_TEAMS = [
    { value: 'OPS_SUPPORT', label: 'IT Operational Support', desc: 'Hardware, Jaringan, Printer, Password' },
    { value: 'ORACLE_DEV', label: 'Oracle Database & K2', desc: 'Permohonan sistem Oracle & K2' },
    { value: 'WEB_DEV', label: 'Web & API Developer', desc: 'Website, Web Portal, REST API Backend' },
    { value: 'MOBILE_DEV', label: 'Mobile Developer', desc: 'Aplikasi Android & iOS Mobile' },
];

export const TicketModulesSettingsTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingModule, setEditingModule] = useState<TicketModule | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('Ticket');
    const [color, setColor] = useState('blue');
    const [isActive, setIsActive] = useState(true);
    const [handlingTeams, setHandlingTeams] = useState<string[]>(['OPS_SUPPORT']);
    const [allowedRoles, setAllowedRoles] = useState<string[]>([
        'ADMIN', 'AGENT_ORACLE', 'AGENT_MOBILE_DEV', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT', 'MANAGER'
    ]);
    const [assigneeRoles, setAssigneeRoles] = useState<string[]>([
        'ADMIN', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV'
    ]);
    const [categories, setCategories] = useState('');
    // New isolation fields (Q2/Q3)
    const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);
    const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);

    // Fetch all modules for admin
    const { data: modules = [], isLoading } = useQuery<TicketModule[]>({
        queryKey: ['ticket-modules', 'admin'],
        queryFn: async () => {
            const res = await api.get('/ticket-modules/admin');
            return res.data;
        },
    });

    // Agents for resolving explicit assignee names in cards and for the picker
    const { data: agents = [] } = useQuery<any[]>({
        queryKey: ['agents', 'all'],
        queryFn: async () => {
            const res = await api.get('/users/agents');
            return res.data;
        },
        staleTime: 60_000,
    });

    const agentById = useMemo(() => {
        const m = new Map<string, any>();
        (agents || []).forEach((a: any) => m.set(a.id, a));
        return m;
    }, [agents]);

    // Create / Update mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                name,
                slug: slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-'),
                description,
                icon,
                color,
                isActive,
                handlingTeams,
                allowedRoles,
                assigneeRoles,
                assigneeUserIds,
                autoAssignEnabled,
                categories: categories
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean),
            };

            if (editingModule) {
                return api.patch(`/ticket-modules/${editingModule.id}`, payload);
            } else {
                return api.post('/ticket-modules', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-modules'] });
            toast.success(editingModule ? 'Modul tiket berhasil diperbarui' : 'Modul tiket baru berhasil dibuat');
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (err: any) => {
            const msg = err.response?.data?.message || 'Gagal menyimpan modul tiket';
            toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/ticket-modules/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-modules'] });
            toast.success('Modul tiket berhasil dihapus');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Gagal menghapus modul');
        },
    });

    // Toggle active mutation
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
            return api.patch(`/ticket-modules/${id}`, { isActive: active });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-modules'] });
            toast.success('Status modul berhasil diubah');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Gagal mengubah status');
        },
    });

    const handleOpenCreate = () => {
        resetForm();
        setEditingModule(null);
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (mod: TicketModule) => {
        setEditingModule(mod);
        setName(mod.name);
        setSlug(mod.slug);
        setDescription(mod.description || '');
        setIcon(mod.icon || 'Ticket');
        setColor(mod.color || 'blue');
        setIsActive(mod.isActive);
        setHandlingTeams(mod.handlingTeams || []);
        setAllowedRoles(mod.allowedRoles || []);
        setAssigneeRoles(mod.assigneeRoles || ['ADMIN', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV']);
        setCategories((mod.categories || []).join(', '));
        // Load new isolation fields
        setAssigneeUserIds(mod.assigneeUserIds || []);
        setAutoAssignEnabled(!!mod.autoAssignEnabled);
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setName('');
        setSlug('');
        setDescription('');
        setIcon('Ticket');
        setColor('blue');
        setIsActive(true);
        setHandlingTeams(['OPS_SUPPORT']);
        setAllowedRoles(['ADMIN', 'AGENT_ORACLE', 'AGENT_MOBILE_DEV', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT', 'MANAGER']);
        setAssigneeRoles(['ADMIN', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV']);
        setCategories('');
        // Reset new isolation fields
        setAssigneeUserIds([]);
        setAutoAssignEnabled(false);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setName(val);
        if (!editingModule) {
            // Auto generate slug
            setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
        }
    };

    const toggleHandlingTeam = (team: string) => {
        setHandlingTeams((prev) =>
            prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
        );
    };

    const toggleRole = (role: string) => {
        setAllowedRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    const toggleAssigneeRole = (role: string) => {
        setAssigneeRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-200/60 dark:border-blue-800/40">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Boxes className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Modul Antrian Tiket (Bongkar Pasang)
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                                Dynamic Queues
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Kelola dan sesuaikan halaman antrian tiket, tim penanganan, kategori, dan hak akses peran secara fleksibel.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Modul Tiket
                </button>
            </div>

            {/* Modules Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/40 animate-pulse border border-slate-200 dark:border-slate-700" />
                    ))}
                </div>
            ) : modules.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <Boxes className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">Belum ada modul tiket</h3>
                    <p className="text-sm text-slate-500 mt-1">Buat modul tiket pertama untuk antrian khusus di sidebar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {modules.map((mod) => {
                        const IconComponent = ICON_MAP[mod.icon] || Ticket;
                        const theme = COLOR_MAP[mod.color] || COLOR_MAP.blue;

                        return (
                            <div
                                key={mod.id}
                                className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md hover:shadow-lg ${
                                    mod.isActive
                                        ? 'border-slate-200 dark:border-slate-700/80 shadow-sm'
                                        : 'border-slate-200/50 dark:border-slate-800/50 opacity-60 bg-slate-50/50 dark:bg-slate-900/20'
                                }`}
                            >
                                <div>
                                    {/* Card Top Row */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3.5">
                                            <div
                                                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${theme.bg} ${theme.text} ${theme.border}`}
                                            >
                                                <IconComponent className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                                        {mod.name}
                                                    </h3>
                                                    {mod.isSystem && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                            <ShieldCheck className="w-3 h-3 text-blue-500" />
                                                            Sistem
                                                        </span>
                                                    )}
                                                    {mod.autoAssignEnabled && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                                                            Auto-assign
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400 font-mono">
                                                    /tickets/queue/{mod.slug}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Switch */}
                                        <div className="flex items-center gap-2">
                                            <Switch.Root
                                                checked={mod.isActive}
                                                onCheckedChange={(checked) =>
                                                    toggleActiveMutation.mutate({ id: mod.id, active: checked })
                                                }
                                                className="w-10 h-6 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-blue-600 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-1 will-change-transform data-[state=checked]:translate-x-5 shadow-sm" />
                                            </Switch.Root>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {mod.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-2">
                                            {mod.description}
                                        </p>
                                    )}

                                    {/* Handling Teams & Categories */}
                                    <div className="mt-4 space-y-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] font-medium text-slate-400 mr-1">Tim:</span>
                                            {mod.handlingTeams && mod.handlingTeams.length > 0 ? (
                                                mod.handlingTeams.map((team) => (
                                                    <span
                                                        key={team}
                                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                                    >
                                                        {team}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">Semua Tim</span>
                                            )}
                                        </div>

                                        {/* Allowed Roles */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] font-medium text-slate-400 mr-1">Akses:</span>
                                            {mod.allowedRoles && mod.allowedRoles.length > 0 ? (
                                                mod.allowedRoles.slice(0, 4).map((role) => (
                                                    <span
                                                        key={role}
                                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40"
                                                    >
                                                        {role.replace('AGENT_', '')}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">Semua Role</span>
                                            )}
                                            {mod.allowedRoles && mod.allowedRoles.length > 4 && (
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    +{mod.allowedRoles.length - 4} lainnya
                                                </span>
                                            )}
                                        </div>

                                        {/* Assignee (people or roles) */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] font-medium text-slate-400 mr-1">Assignee:</span>
                                            {mod.assigneeUserIds && mod.assigneeUserIds.length > 0 ? (
                                                <>
                                                    {mod.assigneeUserIds.slice(0, 4).map((uid) => {
                                                        const a = agentById.get(uid);
                                                        const label = a?.fullName || uid.slice(0, 8);
                                                        return (
                                                            <span
                                                                key={uid}
                                                                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40"
                                                            >
                                                                {label}
                                                            </span>
                                                        );
                                                    })}
                                                    {mod.assigneeUserIds.length > 4 && (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            +{mod.assigneeUserIds.length - 4} lainnya
                                                        </span>
                                                    )}
                                                </>
                                            ) : mod.assigneeRoles && mod.assigneeRoles.length > 0 ? (
                                                <>
                                                    {mod.assigneeRoles.slice(0, 4).map((role) => (
                                                        <span
                                                            key={role}
                                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40"
                                                        >
                                                            {role.replace('AGENT_', '')}
                                                        </span>
                                                    ))}
                                                    {mod.assigneeRoles.length > 4 && (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            +{mod.assigneeRoles.length - 4} lainnya
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">Default Ops</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Action Buttons */}
                                <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                    <button
                                        onClick={() => handleOpenEdit(mod)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                        Ubah
                                    </button>

                                    {!mod.isSystem && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Yakin ingin menghapus modul antrian "${mod.name}"?`)) {
                                                    deleteMutation.mutate(mod.id);
                                                }
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Hapus
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-50 outline-none animate-scale-in">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <Boxes className="w-5 h-5" />
                                </div>
                                <div>
                                    <Dialog.Title className="text-lg font-bold text-slate-800 dark:text-white">
                                        {editingModule ? 'Ubah Modul Tiket' : 'Tambah Modul Tiket Baru'}
                                    </Dialog.Title>
                                    <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400">
                                        Konfigurasi antrian tiket kustom untuk ditampilkan di sidebar dan sistem iDesk.
                                    </Dialog.Description>
                                </div>
                            </div>
                            <Dialog.Close className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </Dialog.Close>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveMutation.mutate();
                            }}
                            className="space-y-5 mt-5"
                        >
                            {/* Name & Slug */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                        Nama Modul <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Contoh: Network & Infrastructure"
                                        value={name}
                                        onChange={handleNameChange}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                        URL Slug <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="network-infra"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                    Deskripsi Singkat
                                </label>
                                <input
                                    type="text"
                                    placeholder="Deskripsi fungsi antrian modul ini..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Icon Picker */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                                    Pilih Icon Visual
                                </label>
                                <div className="grid grid-cols-6 sm:grid-cols-11 gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 max-h-36 overflow-y-auto">
                                    {Object.keys(ICON_MAP).map((iconKey) => {
                                        const I = ICON_MAP[iconKey];
                                        const isSelected = icon === iconKey;
                                        return (
                                            <button
                                                key={iconKey}
                                                type="button"
                                                onClick={() => setIcon(iconKey)}
                                                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-500 scale-105'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
                                                }`}
                                                title={iconKey}
                                            >
                                                <I className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Color Theme Picker */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                                    Aksen Warna Modul
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {Object.keys(COLOR_MAP).map((colorKey) => {
                                        const c = COLOR_MAP[colorKey];
                                        const isSelected = color === colorKey;
                                        return (
                                            <button
                                                key={colorKey}
                                                type="button"
                                                onClick={() => setColor(colorKey)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border flex items-center gap-2 transition-all ${c.bg} ${c.text} ${c.border} ${
                                                    isSelected ? `ring-2 ${c.ring} shadow-sm font-bold scale-105` : 'opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                <span className={`w-2.5 h-2.5 rounded-full ${c.text.replace('text-', 'bg-')}`} />
                                                {colorKey}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Handling Teams Selection */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                                    Target Handling Team (Sumber Tiket)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {ALL_HANDLING_TEAMS.map((team) => {
                                        const isChecked = handlingTeams.includes(team.value);
                                        return (
                                            <div
                                                key={team.value}
                                                onClick={() => toggleHandlingTeam(team.value)}
                                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                                                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div
                                                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                                                        isChecked
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'border-slate-300 dark:border-slate-600'
                                                    }`}
                                                >
                                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-slate-800 dark:text-white block">
                                                        {team.label}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        {team.desc}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Categories Filter */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                    Filter Kategori Khusus (Opsional, pisahkan dengan koma)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Website, Web Portal, API Backend"
                                    value={categories}
                                    onChange={(e) => setCategories(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Jika diisi, antrian modul ini akan mencakup tiket dengan kategori tersebut.
                                </p>
                            </div>

                            {/* Allowed Roles Selection */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                                    Role Yang Diizinkan Mengakses Modul
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ROLES.map((role) => {
                                        const isChecked = allowedRoles.includes(role.value);
                                        return (
                                            <button
                                                key={role.value}
                                                type="button"
                                                onClick={() => toggleRole(role.value)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                                    isChecked
                                                        ? `${role.color} ring-1 ring-current font-semibold`
                                                        : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                {isChecked && <Check className="w-3.5 h-3.5" />}
                                                {role.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Assignee Roles Selection */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                                    Role Assignee (Dapat Ditugaskan Mengerjakan Tiket)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ROLES.filter((r) => r.value !== 'USER').map((role) => {
                                        const isChecked = assigneeRoles.includes(role.value);
                                        return (
                                            <button
                                                key={role.value}
                                                type="button"
                                                onClick={() => toggleAssigneeRole(role.value)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                                    isChecked
                                                        ? `${role.color} ring-1 ring-current font-semibold`
                                                        : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                {isChecked && <Check className="w-3.5 h-3.5" />}
                                                {role.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    Hanya akun dengan role terpilih yang akan muncul di dropdown penugasan (assignee) pada tiket modul ini.
                                </p>
                            </div>

                            {/* Explicit per-person assignees + Auto-assign toggle (Q8/Q9) */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        Daftar Agent Spesifik (Opsional)
                                    </label>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-500">Auto-assign</span>
                                        <Switch.Root
                                            checked={autoAssignEnabled}
                                            onCheckedChange={setAutoAssignEnabled}
                                            className="w-9 h-5 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-emerald-600 rounded-full relative focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        >
                                            <Switch.Thumb className="block w-3.5 h-3.5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-5 shadow-sm" />
                                        </Switch.Root>
                                    </div>
                                </div>

                                <ModuleAssigneePicker
                                    selectedIds={assigneeUserIds}
                                    onChange={setAssigneeUserIds}
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    Isi daftar ini untuk membatasi siapa saja yang boleh di-assign ke modul ini (manual &amp; auto). Kosong = fallback ke Role Assignee di atas.
                                </p>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Batal
                                    </button>
                                </Dialog.Close>
                                <button
                                    type="submit"
                                    disabled={saveMutation.isPending}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                                >
                                    {saveMutation.isPending ? 'Menyimpan...' : editingModule ? 'Simpan Perubahan' : 'Buat Modul'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
};
