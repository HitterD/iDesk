import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cloud,
    Plus,
    Settings,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Trash2,
    Edit2,
    ExternalLink,
    Play,
    History,
    Table2,
    Link2,
    Clock,
    Zap,
} from 'lucide-react';
import {
    useGoogleSyncStatus,
    useSpreadsheetConfigs,
    useSpreadsheetSheets,
    useSyncLogs,
    useTriggerSync,
    useDeleteSpreadsheetConfig,
    SpreadsheetConfig,
    SpreadsheetSheet,
    SyncLog,
} from '../hooks/useGoogleSync';
import { AddSpreadsheetModal } from '../components/AddSpreadsheetModal';
import { SheetMappingModal } from '../components/SheetMappingModal';
import { formatDistanceToNow, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_CONFIG = {
    SUCCESS: { label: 'Success', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
    FAILED: { label: 'Failed', color: 'bg-red-500/20 text-red-400', icon: XCircle },
    PARTIAL: { label: 'Partial', color: 'bg-yellow-500/20 text-yellow-400', icon: AlertTriangle },
    CONFLICT: { label: 'Conflict', color: 'bg-orange-500/20 text-orange-400', icon: AlertTriangle },
};

export default function GoogleSyncSettingsPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState<SpreadsheetConfig | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<SpreadsheetSheet | null>(null);
    const [activeTab, setActiveTab] = useState<'configs' | 'logs'>('configs');

    const { data: status, isLoading: statusLoading } = useGoogleSyncStatus();
    const { data: configs = [], isLoading: configsLoading, refetch: refetchConfigs } = useSpreadsheetConfigs();
    const { data: sheets = [] } = useSpreadsheetSheets();
    const { data: logs = [] } = useSyncLogs(undefined, 50);

    const deleteConfig = useDeleteSpreadsheetConfig();
    const triggerSync = useTriggerSync();

    const handleDeleteConfig = async (id: string) => {
        if (confirm('Hapus konfigurasi spreadsheet ini? Semua mapping sheet juga akan dihapus.')) {
            try {
                await deleteConfig.mutateAsync(id);
                toast.success('Konfigurasi berhasil dihapus');
            } catch (e: any) {
                toast.error(e.response?.data?.message || 'Gagal menghapus');
            }
        }
    };

    const handleSyncSheet = async (sheetId: string) => {
        try {
            await triggerSync.mutateAsync(sheetId);
            toast.success('Sync job berhasil di-queue');
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Gagal trigger sync');
        }
    };

    const getSheetsByConfig = (configId: string) => {
        return sheets.filter(s => s.configId === configId);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Cloud className="w-8 h-8 text-green-500" />
                            Google Sheets Sync
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Konfigurasi sinkronisasi data dengan Google Spreadsheet
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Status Indicator */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${status?.isAvailable
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${status?.isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                            {status?.isAvailable ? 'API Connected' : 'API Disconnected'}
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddModal(true)}
                            disabled={!status?.isAvailable}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-5 h-5" />
                            Tambah Spreadsheet
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Setup Wizard Banner - when Google API is not connected */}
            {!status?.isAvailable && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-6"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-amber-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                Google Sheets Sync Not Configured
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-4">
                                To enable synchronization with Google Spreadsheet, follow these steps:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                                    <div>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">Create Google Cloud Project</p>
                                        <p className="text-slate-500 dark:text-slate-400">Enable Google Sheets API in your project</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                                    <div>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">Create Service Account</p>
                                        <p className="text-slate-500 dark:text-slate-400">Download JSON credentials file</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                                    <div>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">Configure Environment</p>
                                        <p className="text-slate-500 dark:text-slate-400">Set GOOGLE_CREDENTIALS_PATH in .env</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                                    <div>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">Restart Backend</p>
                                        <p className="text-slate-500 dark:text-slate-400">Restart the backend server to apply changes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Spreadsheets</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{status?.activeSpreadsheets || 0}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <Table2 className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Active Syncs</p>
                            <p className="text-3xl font-bold text-cyan-400 mt-1">{status?.activeSyncSheets || 0}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-cyan-400" />
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
                            <p className="text-slate-400 text-sm">Last Sync</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                {logs[0] ? formatDistanceToNow(new Date(logs[0].syncedAt), { addSuffix: true, locale: localeId }) : '-'}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'configs'
                        ? 'bg-primary dark:bg-white/10 text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Konfigurasi
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'logs'
                        ? 'bg-primary dark:bg-white/10 text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                >
                    <History className="w-4 h-4 inline mr-2" />
                    Sync Logs
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'configs' ? (
                    <motion.div
                        key="configs"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-4"
                    >
                        {configsLoading ? (
                            <div className="text-center py-16 text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                                Loading...
                            </div>
                        ) : configs.length === 0 ? (
                            <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
                                <Cloud className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                                <p className="text-slate-400 mb-4">Belum ada spreadsheet yang dikonfigurasi</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    disabled={!status?.isAvailable}
                                    className="px-5 py-2.5 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4 inline mr-2" />
                                    Tambah Spreadsheet
                                </button>
                            </div>
                        ) : (
                            configs.map((config) => (
                                <motion.div
                                    key={config.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden"
                                >
                                    {/* Config Header */}
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                                <Table2 className="w-5 h-5 text-green-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-slate-900 dark:text-white font-medium">{config.name}</h3>
                                                <p className="text-slate-400 text-sm flex items-center gap-2">
                                                    <Link2 className="w-3 h-3" />
                                                    {config.spreadsheetId.slice(0, 20)}...
                                                    {config.spreadsheetUrl && (
                                                        <a
                                                            href={config.spreadsheetUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-green-400 hover:text-green-300"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs ${config.isActive
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {config.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setSelectedConfig(config);
                                                    setSelectedSheet(null);
                                                    setShowMappingModal(true);
                                                }}
                                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                title="Add Sheet Mapping"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteConfig(config.id)}
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sheets */}
                                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                                        {getSheetsByConfig(config.id).length === 0 ? (
                                            <div className="px-6 py-8 text-center text-slate-400">
                                                <p className="mb-2">Belum ada sheet mapping</p>
                                                <button
                                                    onClick={() => {
                                                        setSelectedConfig(config);
                                                        setSelectedSheet(null);
                                                        setShowMappingModal(true);
                                                    }}
                                                    className="text-green-400 hover:text-green-300"
                                                >
                                                    <Plus className="w-4 h-4 inline mr-1" />
                                                    Tambah Mapping
                                                </button>
                                            </div>
                                        ) : (
                                            getSheetsByConfig(config.id).map((sheet) => (
                                                <div key={sheet.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${sheet.syncEnabled ? 'bg-emerald-400' : 'bg-slate-500'
                                                            }`} />
                                                        <div>
                                                            <p className="text-slate-900 dark:text-white">{sheet.sheetName}</p>
                                                            <p className="text-slate-400 text-sm">
                                                                {sheet.dataType} • {sheet.syncDirection} • {sheet.syncIntervalSeconds}s
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {sheet.lastSyncAt && (
                                                            <span className="text-slate-500 text-xs">
                                                                {formatDistanceToNow(new Date(sheet.lastSyncAt), { addSuffix: true })}
                                                            </span>
                                                        )}
                                                        {sheet.lastSyncError && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                                                                Error
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => handleSyncSheet(sheet.id)}
                                                            disabled={!sheet.syncEnabled}
                                                            className="p-2 hover:bg-green-500/20 rounded-lg text-slate-400 hover:text-green-400 transition-colors disabled:opacity-50"
                                                            title="Sync Now"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedConfig(config);
                                                                setSelectedSheet(sheet);
                                                                setShowMappingModal(true);
                                                            }}
                                                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="logs"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden"
                    >
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-4 px-6 text-slate-400 font-medium">Waktu</th>
                                    <th className="text-left py-4 px-6 text-slate-400 font-medium">Status</th>
                                    <th className="text-left py-4 px-6 text-slate-400 font-medium">Direction</th>
                                    <th className="text-left py-4 px-6 text-slate-400 font-medium">Records</th>
                                    <th className="text-left py-4 px-6 text-slate-400 font-medium">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center text-slate-400">
                                            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            Belum ada sync log
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const statusCfg = STATUS_CONFIG[log.status];
                                        const StatusIcon = statusCfg.icon;
                                        return (
                                            <tr key={log.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                                                <td className="py-3 px-6 text-slate-300">
                                                    {format(new Date(log.syncedAt), 'dd MMM HH:mm', { locale: localeId })}
                                                </td>
                                                <td className="py-3 px-6">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${statusCfg.color}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusCfg.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-6 text-slate-300">{log.direction}</td>
                                                <td className="py-3 px-6 text-slate-300">
                                                    <span className="text-emerald-400">+{log.recordsCreated}</span>
                                                    <span className="text-slate-500 mx-1">/</span>
                                                    <span className="text-cyan-400">~{log.recordsUpdated}</span>
                                                    {log.recordsSkipped > 0 && (
                                                        <>
                                                            <span className="text-slate-500 mx-1">/</span>
                                                            <span className="text-yellow-400">⊘{log.recordsSkipped}</span>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="py-3 px-6 text-slate-400">{log.durationMs}ms</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <AddSpreadsheetModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
            />
            <SheetMappingModal
                isOpen={showMappingModal}
                onClose={() => {
                    setShowMappingModal(false);
                    setSelectedConfig(null);
                    setSelectedSheet(null);
                }}
                config={selectedConfig}
                sheet={selectedSheet}
            />
        </div>
    );
}
