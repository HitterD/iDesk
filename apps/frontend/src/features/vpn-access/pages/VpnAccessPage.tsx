import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    Plus,
    Search,
    Filter,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    Wifi,
    Users,
    Calendar,
    MoreVertical,
    Edit2,
    Trash2,
    Key,
    Bell,
} from 'lucide-react';
import {
    useVpnAccessList,
    useVpnStats,
    useVpnExpiring,
    useDeleteVpnAccess,
    useRevokeVpnAccess,
    VpnAccess,
    VpnFilters,
} from '../hooks/useVpnAccess';
import { VpnAccessModal } from '../components/VpnAccessModal';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const STATUS_CONFIG = {
    ACTIVE: { label: 'Aktif', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
    EXPIRED: { label: 'Expired', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
    REVOKED: { label: 'Dicabut', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: XCircle },
    PENDING: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
};

const VPN_TYPE_CONFIG = {
    SITE_TO_SITE: { label: 'Site-to-Site', icon: '🔗' },
    CLIENT: { label: 'Client VPN', icon: '💻' },
    SSL: { label: 'SSL VPN', icon: '🔒' },
};

export default function VpnAccessPage() {
    const [filters, setFilters] = useState<VpnFilters>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedVpn, setSelectedVpn] = useState<VpnAccess | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Confirmation dialog states
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
    const [revokeConfirm, setRevokeConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const { data: vpnList = [], isLoading, refetch } = useVpnAccessList({
        ...filters,
        search: searchQuery || undefined,
    });
    const { data: stats } = useVpnStats();
    const { data: expiring = [] } = useVpnExpiring(30);

    const deleteVpn = useDeleteVpnAccess();
    const revokeVpn = useRevokeVpnAccess();

    const filteredList = useMemo(() => {
        return vpnList;
    }, [vpnList]);

    const handleEdit = (vpn: VpnAccess) => {
        setSelectedVpn(vpn);
        setShowModal(true);
        setActiveMenu(null);
    };

    const handleDeleteClick = (id: string) => {
        setDeleteConfirm({ open: true, id });
        setActiveMenu(null);
    };

    const handleDeleteConfirm = async () => {
        if (deleteConfirm.id) {
            await deleteVpn.mutateAsync(deleteConfirm.id);
        }
        setDeleteConfirm({ open: false, id: null });
    };

    const handleRevokeClick = (id: string) => {
        setRevokeConfirm({ open: true, id });
        setActiveMenu(null);
    };

    const handleRevokeConfirm = async () => {
        if (revokeConfirm.id) {
            await revokeVpn.mutateAsync(revokeConfirm.id);
        }
        setRevokeConfirm({ open: false, id: null });
    };

    const getDaysUntilExpiry = (validUntil: string) => {
        return differenceInDays(new Date(validUntil), new Date());
    };

    const getExpiryBadge = (validUntil: string, status: string) => {
        if (status !== 'ACTIVE') return null;
        const days = getDaysUntilExpiry(validUntil);
        if (days <= 0) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/30 text-red-300">EXPIRED</span>;
        if (days <= 7) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/30 text-red-300">D-{days}</span>;
        if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/30 text-yellow-300">D-{days}</span>;
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Shield className="w-8 h-8 text-cyan-500" />
                            VPN Access Management
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Kelola dan monitor akses VPN WatchGuard
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            setSelectedVpn(null);
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow"
                    >
                        <Plus className="w-5 h-5" />
                        Tambah VPN Access
                    </motion.button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Total VPN</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats?.total || 0}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Wifi className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Aktif</p>
                            <p className="text-3xl font-bold text-emerald-400 mt-1">{stats?.active || 0}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Expiring (30d)</p>
                            <p className="text-3xl font-bold text-yellow-400 mt-1">{stats?.expiringSoon || 0}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-yellow-400" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Expired</p>
                            <p className="text-3xl font-bold text-red-400 mt-1">{stats?.expired || 0}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Expiring Soon Alert */}
            {expiring.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
                >
                    <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-yellow-400" />
                        <span className="text-yellow-200">
                            <strong>{expiring.length}</strong> VPN access akan expired dalam 30 hari ke depan
                        </span>
                    </div>
                </motion.div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari username, nama, atau email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={filters.status || ''}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                        className="px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[140px]"
                    >
                        <option value="">Semua Status</option>
                        <option value="ACTIVE">Aktif</option>
                        <option value="EXPIRED">Expired</option>
                        <option value="REVOKED">Dicabut</option>
                    </select>
                    <select
                        value={filters.vpnType || ''}
                        onChange={(e) => setFilters({ ...filters, vpnType: e.target.value || undefined })}
                        className="px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[140px]"
                    >
                        <option value="">Semua Tipe</option>
                        <option value="SITE_TO_SITE">Site-to-Site</option>
                        <option value="CLIENT">Client VPN</option>
                        <option value="SSL">SSL VPN</option>
                    </select>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => refetch()}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </motion.button>
                </div>
            </div>

            {/* Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Username</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Nama</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Tipe</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Valid Sampai</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Status</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Site</th>
                                <th className="text-right py-4 px-6 text-slate-400 font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                // Skeleton loader rows
                                [...Array(5)].map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="border-b border-white/5 animate-pulse">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
                                            <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg ml-auto" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400">
                                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Tidak ada data VPN access</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((vpn, idx) => {
                                    const statusCfg = STATUS_CONFIG[vpn.status];
                                    const typeCfg = VPN_TYPE_CONFIG[vpn.vpnType];
                                    const StatusIcon = statusCfg.icon;

                                    return (
                                        <motion.tr
                                            key={vpn.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <Key className="w-4 h-4 text-cyan-400" />
                                                    <span className="text-slate-900 dark:text-white font-medium">{vpn.username}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div>
                                                    <p className="text-slate-900 dark:text-white">{vpn.fullName}</p>
                                                    {vpn.email && (
                                                        <p className="text-slate-400 text-sm">{vpn.email}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 text-slate-300 text-sm">
                                                    {typeCfg?.icon} {typeCfg?.label || vpn.vpnType}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-300">
                                                        {format(new Date(vpn.validUntil), 'dd MMM yyyy', { locale: localeId })}
                                                    </span>
                                                    {getExpiryBadge(vpn.validUntil, vpn.status)}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${statusCfg.color}`}>
                                                    <StatusIcon className="w-3.5 h-3.5" />
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-slate-300">{vpn.site || '-'}</span>
                                            </td>
                                            <td className="py-4 px-6 text-right relative">
                                                <button
                                                    onClick={() => setActiveMenu(activeMenu === vpn.id ? null : vpn.id)}
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <MoreVertical className="w-5 h-5 text-slate-400" />
                                                </button>
                                                <AnimatePresence>
                                                    {activeMenu === vpn.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                            className="absolute right-6 top-12 z-10 w-44 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                                                        >
                                                            <button
                                                                onClick={() => handleEdit(vpn)}
                                                                className="w-full flex items-center gap-2 px-4 py-3 text-slate-300 hover:bg-white/5 transition-colors"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                                Edit
                                                            </button>
                                                            {vpn.status === 'ACTIVE' && (
                                                                <button
                                                                    onClick={() => handleRevokeClick(vpn.id)}
                                                                    className="w-full flex items-center gap-2 px-4 py-3 text-yellow-400 hover:bg-white/5 transition-colors"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                    Revoke
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteClick(vpn.id)}
                                                                className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-white/5 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                Hapus
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Modal */}
            <VpnAccessModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setSelectedVpn(null);
                }}
                vpnAccess={selectedVpn}
            />

            {/* Confirmation Dialogs */}
            <ConfirmDialog
                isOpen={deleteConfirm.open}
                onClose={() => setDeleteConfirm({ open: false, id: null })}
                onConfirm={handleDeleteConfirm}
                title="Hapus VPN Access"
                message="Apakah Anda yakin ingin menghapus data VPN access ini? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                variant="danger"
            />

            <ConfirmDialog
                isOpen={revokeConfirm.open}
                onClose={() => setRevokeConfirm({ open: false, id: null })}
                onConfirm={handleRevokeConfirm}
                title="Cabut Akses VPN"
                message="Apakah Anda yakin ingin mencabut akses VPN ini? User tidak akan bisa menggunakan VPN setelah dicabut."
                confirmText="Cabut Akses"
                cancelText="Batal"
                variant="warning"
            />
        </div>
    );
}
