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
    SUCCESS: { label: 'Success', color: 'bg-[hsl(var(--success-50))] text-[hsl(var(--success-700))] dark:bg-[hsl(var(--success-900))]/20 dark:text-[hsl(var(--success-400))]', icon: CheckCircle2 },
    FAILED: { label: 'Failed', color: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-700))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-400))]', icon: XCircle },
    PARTIAL: { label: 'Partial', color: 'bg-[hsl(var(--warning-50))] text-[hsl(var(--warning-700))] dark:bg-[hsl(var(--warning-900))]/20 dark:text-[hsl(var(--warning-400))]', icon: AlertTriangle },
    CONFLICT: { label: 'Conflict', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', icon: AlertTriangle },
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
        <div className="space-y-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Cloud className="w-8 h-8 text-[hsl(var(--success-500))]" />
                            Google Sheets Sync
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Konfigurasi sinkronisasi data dengan Google Spreadsheet
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Status Indicator */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-medium ${status?.isAvailable
                            ? 'bg-[hsl(var(--success-50))] border-[hsl(var(--success-200))] text-[hsl(var(--success-700))] dark:bg-[hsl(var(--success-900))]/20 dark:border-[hsl(var(--success-800))] dark:text-[hsl(var(--success-400))]'
                            : 'bg-[hsl(var(--error-50))] border-[hsl(var(--error-200))] text-[hsl(var(--error-700))] dark:bg-[hsl(var(--error-900))]/20 dark:border-[hsl(var(--error-800))] dark:text-[hsl(var(--error-400))]'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${status?.isAvailable ? 'bg-[hsl(var(--success-500))] animate-pulse' : 'bg-[hsl(var(--error-500))]'}`} />
                            {status?.isAvailable ? 'API Connected' : 'API Disconnected'}
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddModal(true)}
                            disabled={!status?.isAvailable}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[hsl(var(--success-500))] hover:bg-[hsl(var(--success-600))] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                    className="mb-8 bg-[hsl(var(--warning-50))] dark:bg-[hsl(var(--warning-900))]/10 border border-[hsl(var(--warning-200))] dark:border-[hsl(var(--warning-800))]/50 rounded-2xl p-6"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--warning-100))] dark:bg-[hsl(var(--warning-500))]/20 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-[hsl(var(--warning-600))] dark:text-[hsl(var(--warning-500))]" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                Google Sheets Sync Not Configured
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-4 font-medium">
                                To enable synchronization with Google Spreadsheet, follow these steps:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-[hsl(var(--warning-200))] dark:bg-[hsl(var(--warning-500))]/30 text-[hsl(var(--warning-700))] dark:text-[hsl(var(--warning-400))] flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                                    <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">Create Google Cloud Project</p>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Enable Google Sheets API in your project</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-[hsl(var(--warning-200))] dark:bg-[hsl(var(--warning-500))]/30 text-[hsl(var(--warning-700))] dark:text-[hsl(var(--warning-400))] flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                                    <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">Create Service Account</p>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Download JSON credentials file</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-[hsl(var(--warning-200))] dark:bg-[hsl(var(--warning-500))]/30 text-[hsl(var(--warning-700))] dark:text-[hsl(var(--warning-400))] flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                                    <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">Configure Environment</p>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Set GOOGLE_CREDENTIALS_PATH in .env</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-[hsl(var(--warning-200))] dark:bg-[hsl(var(--warning-500))]/30 text-[hsl(var(--warning-700))] dark:text-[hsl(var(--warning-400))] flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                                    <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">Restart Backend</p>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Restart the backend server to apply changes</p>
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
                    className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 shadow-sm overflow-hidden relative group"
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[hsl(var(--success-500))]/50"></div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Spreadsheets</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{status?.activeSpreadsheets || 0}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success-50))] dark:bg-[hsl(var(--success-900))]/20 flex items-center justify-center">
                            <Table2 className="w-5 h-5 text-[hsl(var(--success-600))] dark:text-[hsl(var(--success-500))]" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 shadow-sm overflow-hidden relative group"
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50"></div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Syncs</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{status?.activeSyncSheets || 0}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-blue-500" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 shadow-sm overflow-hidden relative group"
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500/50"></div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Last Sync</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                {logs[0] ? formatDistanceToNow(new Date(logs[0].syncedAt), { addSuffix: true, locale: localeId }) : '-'}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-purple-500" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('configs')}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-colors duration-150 ${activeTab === 'configs'
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Konfigurasi
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-colors duration-150 ${activeTab === 'logs'
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
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
                            <div className="text-center py-16 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm">
                                <Cloud className="w-12 h-12 mx-auto mb-3 text-slate-400 dark:text-slate-500" />
                                <p className="text-slate-500 dark:text-slate-400 mb-4 font-medium">Belum ada spreadsheet yang dikonfigurasi</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    disabled={!status?.isAvailable}
                                    className="px-5 py-2.5 bg-[hsl(var(--success-50))] text-[hsl(var(--success-700))] rounded-xl hover:bg-[hsl(var(--success-100))] dark:bg-[hsl(var(--success-900))]/20 dark:text-[hsl(var(--success-400))] dark:hover:bg-[hsl(var(--success-900))]/40 transition-colors disabled:opacity-50 font-semibold"
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
                                    className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm"
                                >
                                    {/* Config Header */}
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success-50))] dark:bg-[hsl(var(--success-900))]/20 flex items-center justify-center">
                                                <Table2 className="w-5 h-5 text-[hsl(var(--success-600))] dark:text-[hsl(var(--success-400))]" />
                                            </div>
                                            <div>
                                                <h3 className="text-slate-900 dark:text-white font-bold">{config.name}</h3>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2 font-medium">
                                                    <Link2 className="w-3 h-3" />
                                                    {config.spreadsheetId.slice(0, 20)}...
                                                    {config.spreadsheetUrl && (
                                                        <a
                                                            href={config.spreadsheetUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:text-primary/80 transition-colors"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.isActive
                                                ? 'bg-[hsl(var(--success-50))] text-[hsl(var(--success-700))] dark:bg-[hsl(var(--success-900))]/20 dark:text-[hsl(var(--success-400))]'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                {config.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setSelectedConfig(config);
                                                    setSelectedSheet(null);
                                                    setShowMappingModal(true);
                                                }}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-[hsl(var(--background))] rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                title="Add Sheet Mapping"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteConfig(config.id)}
                                                className="p-2 hover:bg-[hsl(var(--error-50))] dark:hover:bg-[hsl(var(--error-900))]/20 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[hsl(var(--error-600))] dark:hover:text-[hsl(var(--error-400))] transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sheets */}
                                    <div className="divide-y divide-[hsl(var(--border))]">
                                        {getSheetsByConfig(config.id).length === 0 ? (
                                            <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                                <p className="mb-3 font-medium">Belum ada sheet mapping</p>
                                                <button
                                                    onClick={() => {
                                                        setSelectedConfig(config);
                                                        setSelectedSheet(null);
                                                        setShowMappingModal(true);
                                                    }}
                                                    className="font-bold text-[hsl(var(--success-600))] hover:text-[hsl(var(--success-700))] dark:text-[hsl(var(--success-400))] dark:hover:text-[hsl(var(--success-300))] transition-colors"
                                                >
                                                    <Plus className="w-4 h-4 inline mr-1" />
                                                    Tambah Mapping
                                                </button>
                                            </div>
                                        ) : (
                                            getSheetsByConfig(config.id).map((sheet) => (
                                                <div key={sheet.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-[hsl(var(--card))] shadow-sm ${sheet.syncEnabled ? 'bg-[hsl(var(--success-500))]' : 'bg-slate-300 dark:bg-slate-600'
                                                            }`} />
                                                        <div>
                                                            <p className="text-slate-900 dark:text-white font-bold">{sheet.sheetName}</p>
                                                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">
                                                                {sheet.dataType} • {sheet.syncDirection} • {sheet.syncIntervalSeconds}s
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {sheet.lastSyncAt && (
                                                            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                                {formatDistanceToNow(new Date(sheet.lastSyncAt), { addSuffix: true })}
                                                            </span>
                                                        )}
                                                        {sheet.lastSyncError && (
                                                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[hsl(var(--error-50))] text-[hsl(var(--error-700))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-400))]">
                                                                Error
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => handleSyncSheet(sheet.id)}
                                                            disabled={!sheet.syncEnabled}
                                                            className="p-2 hover:bg-[hsl(var(--success-50))] rounded-lg text-slate-500 hover:text-[hsl(var(--success-600))] dark:hover:bg-[hsl(var(--success-900))]/20 dark:text-slate-400 dark:hover:text-[hsl(var(--success-400))] transition-colors disabled:opacity-50"
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
                                                            className="p-2 hover:bg-slate-100 dark:hover:bg-[hsl(var(--background))] rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                        className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm flex flex-col"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]">
                                        <th className="text-left py-4 px-6 text-xs tracking-wider uppercase font-bold text-slate-500">Waktu</th>
                                        <th className="text-left py-4 px-6 text-xs tracking-wider uppercase font-bold text-slate-500">Status</th>
                                        <th className="text-left py-4 px-6 text-xs tracking-wider uppercase font-bold text-slate-500">Direction</th>
                                        <th className="text-left py-4 px-6 text-xs tracking-wider uppercase font-bold text-slate-500">Records</th>
                                        <th className="text-left py-4 px-6 text-xs tracking-wider uppercase font-bold text-slate-500">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-slate-400">
                                                <History className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-400" />
                                                <p className="font-medium text-slate-500">Belum ada sync log</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => {
                                            const statusCfg = STATUS_CONFIG[log.status];
                                            const StatusIcon = statusCfg.icon;
                                            return (
                                                <tr key={log.id} className="border-b border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors">
                                                    <td className="py-3 px-6 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {format(new Date(log.syncedAt), 'dd MMM HH:mm', { locale: localeId })}
                                                    </td>
                                                    <td className="py-3 px-6">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${statusCfg.color}`}>
                                                            <StatusIcon className="w-3.5 h-3.5" />
                                                            {statusCfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-6 text-sm font-medium text-slate-700 dark:text-slate-300">{log.direction}</td>
                                                    <td className="py-3 px-6 text-sm font-bold">
                                                        <span className="text-[hsl(var(--success-600))] dark:text-[hsl(var(--success-500))]">+{log.recordsCreated}</span>
                                                        <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                                                        <span className="text-primary">~{log.recordsUpdated}</span>
                                                        {log.recordsSkipped > 0 && (
                                                            <>
                                                                <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                                                                <span className="text-[hsl(var(--warning-600))] dark:text-[hsl(var(--warning-500))]">⊘{log.recordsSkipped}</span>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-6 text-sm font-medium text-slate-500 dark:text-slate-400">{log.durationMs}ms</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
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
