import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    HardDrive,
    Server,
    Play,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Trash2,
    Plus,
    TestTube,
    Folder,
    ArrowUp,
    Check,
    Pencil,
    RotateCcw,
    AlertTriangle,
    Upload,
    Database,
    FileText,
    ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import api from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';

interface BackupConfig {
    id: string;
    name: string;
    synologyHost: string;
    synologyPort: number;
    synologyUsername?: string;
    backupType: 'DATABASE' | 'FILES' | 'FULL';
    destinationFolder: string;
    scheduleCron: string;
    retentionDays: number;
    isActive: boolean;
    lastBackupAt: string | null;
    lastBackupStatus: string | null;
}

interface BackupHistory {
    id: string;
    configId: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    backupType: string;
    startedAt: string;
    completedAt: string | null;
    filePath?: string | null;
    fileSizeBytes: number | null;
    errorMessage: string | null;
    config?: BackupConfig;
}

export default function SynologyBackupSettings() {
    const [configs, setConfigs] = useState<BackupConfig[]>([]);
    const [history, setHistory] = useState<BackupHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [executing, setExecuting] = useState<string | null>(null);
    const [syncingUploads, setSyncingUploads] = useState(false);

    // Folder browser state
    const [showFolderBrowser, setShowFolderBrowser] = useState(false);
    const [folderList, setFolderList] = useState<Array<{ name: string; path: string; isDir: boolean; size?: number }>>([]);
    const [currentBrowsePath, setCurrentBrowsePath] = useState('/');
    const [browsing, setBrowsing] = useState(false);
    const [browserMode, setBrowserMode] = useState<'destination' | 'restore'>('destination');
    const [selectedNasFileForRestore, setSelectedNasFileForRestore] = useState<{ path: string; name: string } | null>(null);
    const [activeRestoreConfigId, setActiveRestoreConfigId] = useState<string>('');

    // Config form
    const [showForm, setShowForm] = useState(false);
    const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        synologyHost: '',
        synologyPort: '5001',
        synologyUsername: '',
        synologyPassword: '',
        destinationPath: '/iDesk-Backups',
        backupType: 'DATABASE',
        scheduleTime: '02:00',
        retentionDays: '30',
    });

    // Restore Hub & Confirmation state
    const [showRestoreHub, setShowRestoreHub] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [restoreType, setRestoreType] = useState<'history' | 'nas' | 'upload'>('history');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<BackupHistory | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [createSnapshot, setCreateSnapshot] = useState(true);
    const [confirmInputText, setConfirmInputText] = useState('');
    const [restoreHubTab, setRestoreHubTab] = useState<'history' | 'nas' | 'upload'>('history');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [configRes, historyRes] = await Promise.all([
                api.get('/backup/configs'),
                api.get('/backup/history?limit=30'),
            ]);

            setConfigs(configRes.data);
            setHistory(historyRes.data);
            if (configRes.data?.length > 0 && !activeRestoreConfigId) {
                setActiveRestoreConfigId(configRes.data[0].id);
            }
        } catch (error) {
            toast.error('Failed to load backup data');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncUploads = async () => {
        setSyncingUploads(true);
        try {
            const response = await api.post('/backup/sync-uploads');
            toast.success(response.data?.message || 'Sinkronisasi file ke Synology NAS berhasil!');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal menyinkronkan file ke Synology NAS');
        } finally {
            setSyncingUploads(false);
        }
    };

    const handleTestConnection = async () => {
        if (!formData.synologyHost || !formData.synologyUsername || (!formData.synologyPassword && !editingConfigId)) {
            toast.error('Isi Host, Port, Username, dan Password untuk test koneksi');
            return;
        }

        setTesting(true);
        try {
            const response = await api.post('/backup/test-connection', {
                synologyHost: formData.synologyHost,
                synologyPort: parseInt(formData.synologyPort, 10),
                synologyUsername: formData.synologyUsername,
                synologyPassword: formData.synologyPassword,
            });

            const result = response.data;
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Connection test failed';
            toast.error(errorMessage);
        } finally {
            setTesting(false);
        }
    };

    // ==========================================
    // Folder & File Browser (browse NAS shares/folders)
    // ==========================================

    const openFolderBrowser = async () => {
        if (!formData.synologyHost || !formData.synologyUsername || !formData.synologyPassword) {
            toast.error('Isi Host, Username, dan Password terlebih dahulu untuk browse folder NAS');
            return;
        }
        setBrowserMode('destination');
        setCurrentBrowsePath(formData.destinationPath || '/');
        setShowFolderBrowser(true);
        await loadFolders(formData.destinationPath || '/', false, formData.synologyHost, parseInt(formData.synologyPort, 10), formData.synologyUsername, formData.synologyPassword);
    };

    const openNasFileBrowserForRestore = async () => {
        const config = configs.find((c) => c.id === activeRestoreConfigId) || configs[0];
        if (!config) {
            toast.error('Pilih konfigurasi Synology yang valid');
            return;
        }

        setBrowserMode('restore');
        const startPath = config.destinationFolder || '/';
        setCurrentBrowsePath(startPath);
        setShowFolderBrowser(true);
        await loadFolders(startPath, true, config.synologyHost, config.synologyPort, config.synologyUsername || '', '');
    };

    const loadFolders = async (path: string, includeFiles: boolean = false, host?: string, port?: number, user?: string, pass?: string) => {
        setBrowsing(true);
        try {
            const targetHost = host || formData.synologyHost;
            const targetPort = port || parseInt(formData.synologyPort, 10);
            const targetUser = user || formData.synologyUsername;
            const targetPass = pass !== undefined ? pass : formData.synologyPassword;

            const response = await api.post('/backup/list-folders', {
                synologyHost: targetHost,
                synologyPort: targetPort,
                synologyUsername: targetUser,
                synologyPassword: targetPass,
                path,
                includeFiles,
            });

            const result = response.data;
            if (result.success) {
                setFolderList(result.folders || []);
                setCurrentBrowsePath(path);
            } else {
                toast.error(result.message || 'Gagal mengambil daftar folder/file');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Gagal browse folder';
            toast.error(msg);
        } finally {
            setBrowsing(false);
        }
    };

    const handleItemClick = (item: { name: string; path: string; isDir: boolean }) => {
        if (item.isDir) {
            const isRestoreMode = browserMode === 'restore';
            loadFolders(item.path, isRestoreMode);
        } else {
            // Clicked a file
            if (browserMode === 'restore') {
                setSelectedNasFileForRestore({ path: item.path, name: item.name });
            }
        }
    };

    const handleNavigateUp = () => {
        if (!currentBrowsePath || currentBrowsePath === '/') return;
        const segments = currentBrowsePath.split('/').filter(Boolean);
        segments.pop();
        const parent = segments.length ? '/' + segments.join('/') : '/';
        loadFolders(parent, browserMode === 'restore');
    };

    const handleSelectPath = () => {
        if (browserMode === 'destination') {
            setFormData({ ...formData, destinationPath: currentBrowsePath });
            setShowFolderBrowser(false);
            toast.success(`Destination diatur ke: ${currentBrowsePath}`);
        } else {
            if (!selectedNasFileForRestore) {
                toast.error('Pilih salah satu file backup (.sql.gz) untuk di-restore');
                return;
            }
            setShowFolderBrowser(false);
            setShowRestoreHub(false);
            setRestoreType('nas');
            setConfirmInputText('');
            setShowRestoreConfirm(true);
        }
    };

    const handleCloseBrowser = () => {
        setShowFolderBrowser(false);
        setFolderList([]);
    };

    // ==========================================
    // Configuration Actions
    // ==========================================

    const openNewForm = () => {
        setEditingConfigId(null);
        setFormData({
            name: '',
            synologyHost: '',
            synologyPort: '5001',
            synologyUsername: '',
            synologyPassword: '',
            destinationPath: '/iDesk-Backups',
            backupType: 'DATABASE',
            scheduleTime: '02:00',
            retentionDays: '30',
        });
        setShowForm(true);
    };

    const openEditForm = (config: BackupConfig) => {
        setEditingConfigId(config.id);
        let scheduleTime = '02:00';
        if (config.scheduleCron) {
            const parts = config.scheduleCron.split(' ');
            if (parts.length >= 2) {
                scheduleTime = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
            }
        }
        setFormData({
            name: config.name,
            synologyHost: config.synologyHost,
            synologyPort: String(config.synologyPort || 5001),
            synologyUsername: config.synologyUsername || '',
            synologyPassword: '',
            destinationPath: config.destinationFolder || '/iDesk-Backups',
            backupType: config.backupType,
            scheduleTime,
            retentionDays: String(config.retentionDays || 30),
        });
        setShowForm(true);
    };

    const handleSaveConfig = async () => {
        try {
            if (!formData.name || !formData.synologyHost || !formData.synologyUsername || !formData.destinationPath) {
                toast.error('Mohon lengkapi semua field yang wajib diisi');
                return;
            }

            if (editingConfigId) {
                const payload: any = {
                    name: formData.name,
                    synologyHost: formData.synologyHost,
                    synologyPort: parseInt(formData.synologyPort, 10),
                    synologyUsername: formData.synologyUsername,
                    destinationPath: formData.destinationPath,
                    backupType: formData.backupType,
                    scheduleTime: formData.scheduleTime,
                    retentionDays: parseInt(formData.retentionDays, 10),
                };
                if (formData.synologyPassword) {
                    payload.synologyPassword = formData.synologyPassword;
                }

                await api.patch(`/backup/configs/${editingConfigId}`, payload);
                toast.success('Konfigurasi backup berhasil diperbarui');
            } else {
                if (!formData.synologyPassword) {
                    toast.error('Password Synology wajib diisi untuk konfigurasi baru');
                    return;
                }

                await api.post('/backup/configs', {
                    name: formData.name,
                    synologyHost: formData.synologyHost,
                    synologyPort: parseInt(formData.synologyPort, 10),
                    synologyUsername: formData.synologyUsername,
                    synologyPassword: formData.synologyPassword,
                    destinationPath: formData.destinationPath,
                    backupType: formData.backupType,
                    scheduleTime: formData.scheduleTime,
                    retentionDays: parseInt(formData.retentionDays, 10),
                });
                toast.success('Konfigurasi backup baru berhasil dibuat');
            }

            setShowForm(false);
            setEditingConfigId(null);
            fetchData();
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Gagal menyimpan konfigurasi';
            toast.error(errorMessage);
        }
    };

    const handleExecuteBackup = async (configId: string) => {
        setExecuting(configId);
        try {
            const response = await api.post(`/backup/execute/${configId}`, {});

            if (response.status === 200 || response.status === 201) {
                toast.success('Backup berhasil dieksekusi');
                fetchData();
            } else {
                toast.error('Gagal menjalankan backup');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Gagal menjalankan backup';
            toast.error(errorMessage);
        } finally {
            setExecuting(null);
        }
    };

    const handleDeleteConfig = async (configId: string) => {
        try {
            await api.delete(`/backup/configs/${configId}`);
            toast.success('Konfigurasi backup berhasil dihapus');
            fetchData();
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Gagal menghapus konfigurasi';
            toast.error(errorMessage);
        }
    };

    // ==========================================
    // Restore Handlers
    // ==========================================

    const openRestoreFromHistory = (item: BackupHistory) => {
        setSelectedHistoryItem(item);
        setRestoreType('history');
        setConfirmInputText('');
        setShowRestoreConfirm(true);
    };

    const openRestoreHub = () => {
        setShowRestoreHub(true);
    };

    const handleConfirmRestore = async () => {
        if (confirmInputText !== 'RESTORE') {
            toast.error('Ketik kata "RESTORE" dengan huruf kapital untuk konfirmasi');
            return;
        }

        setRestoring(true);
        try {
            if (restoreType === 'history' && selectedHistoryItem) {
                const response = await api.post(`/backup/restore/history/${selectedHistoryItem.id}`, {
                    createSnapshot,
                });
                toast.success(response.data?.message || 'Database berhasil di-restore');
            } else if (restoreType === 'nas' && selectedNasFileForRestore) {
                const response = await api.post('/backup/restore/nas', {
                    configId: activeRestoreConfigId,
                    nasFilePath: selectedNasFileForRestore.path,
                    createSnapshot,
                });
                toast.success(response.data?.message || 'Database berhasil di-restore dari Synology NAS');
            } else if (restoreType === 'upload' && uploadedFile) {
                const form = new FormData();
                form.append('file', uploadedFile);
                form.append('createSnapshot', String(createSnapshot));

                const response = await api.post('/backup/restore/upload', form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success(response.data?.message || 'Database berhasil di-restore dari file unggahan');
            }

            setShowRestoreConfirm(false);
            setShowRestoreHub(false);
            setConfirmInputText('');
            fetchData();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Gagal melakukan restore database';
            toast.error(msg);
        } finally {
            setRestoring(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
            case 'FAILED':
                return <Badge className="bg-rose-500 hover:bg-rose-600 text-white"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
            case 'RUNNING':
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const successfulHistories = history.filter((h) => h.status === 'SUCCESS');

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Synology NAS Backup & Restore</h2>
                    <p className="text-sm text-muted-foreground">Konfigurasi pencadangan otomatis dan pemulihan data database (RS1221)</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSyncUploads}
                        disabled={syncingUploads}
                        className="border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 shadow-xs"
                        title="Sinkronisasikan seluruh file lampiran tiket, avatar, dan media Telegram ke Synology NAS sekarang"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncingUploads ? 'animate-spin text-blue-600' : 'text-blue-600'}`} />
                        {syncingUploads ? 'Menyinkronkan File...' : 'Sync File ke Synology'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={openRestoreHub}
                        className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 shadow-xs"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore Database
                    </Button>
                    <Button onClick={openNewForm} className="shadow-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Configuration
                    </Button>
                </div>
            </div>

            {/* Config Form (Create / Edit) */}
            {showForm && (
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/40 pb-4">
                        <CardTitle className="flex items-center justify-between text-base">
                            <span className="flex items-center gap-2">
                                <Server className="h-5 w-5 text-primary" />
                                {editingConfigId ? 'Edit Konfigurasi Backup Synology' : 'Tambah Konfigurasi Backup Baru'}
                            </span>
                            {editingConfigId && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                    Mode Edit
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {editingConfigId
                                ? 'Perbarui koneksi, folder tujuan NAS, jadwal, atau ganti password'
                                : 'Hubungkan iDesk ke server Synology DSM untuk backup database & file berkala'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nama Konfigurasi</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="contoh: Daily Database Backup"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipe Backup</Label>
                                <Select
                                    value={formData.backupType}
                                    onValueChange={(val) => setFormData({ ...formData, backupType: val as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FULL">
                                            <span className="font-semibold text-blue-700 dark:text-blue-400">Full Backup (Database & Chat + Semua File) — Rekomendasi</span>
                                        </SelectItem>
                                        <SelectItem value="DATABASE">Database Only (.sql.gz - Riwayat Chat & Tabel DB)</SelectItem>
                                        <SelectItem value="FILES">Files Only (.tar.gz - Uploads / Lampiran / Media)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <Label>Synology Host (IP / Domain)</Label>
                                <Input
                                    value={formData.synologyHost}
                                    onChange={(e) => setFormData({ ...formData, synologyHost: e.target.value })}
                                    placeholder="192.168.2.17 atau nas.company.local"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Port DSM</Label>
                                <Input
                                    value={formData.synologyPort}
                                    onChange={(e) => setFormData({ ...formData, synologyPort: e.target.value })}
                                    placeholder="5001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Username DSM</Label>
                                <Input
                                    value={formData.synologyUsername}
                                    onChange={(e) => setFormData({ ...formData, synologyUsername: e.target.value })}
                                    placeholder="admin / backup_user"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Password DSM{' '}
                                    {editingConfigId && (
                                        <span className="text-xs text-muted-foreground font-normal">
                                            (Kosongkan jika tidak ingin diubah)
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    type="password"
                                    value={formData.synologyPassword}
                                    onChange={(e) => setFormData({ ...formData, synologyPassword: e.target.value })}
                                    placeholder={editingConfigId ? '•••••••• (menggunakan password tersimpan)' : 'Masukkan password'}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 col-span-1 md:col-span-1">
                                <Label>Folder Tujuan di NAS</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.destinationPath}
                                        onChange={(e) => setFormData({ ...formData, destinationPath: e.target.value })}
                                        placeholder="/iDesk-Backups"
                                        className="flex-1 font-mono text-xs"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={openFolderBrowser}
                                        disabled={browsing}
                                        title="Browse folder di Synology NAS"
                                        className="shrink-0"
                                    >
                                        <Folder className="h-4 w-4 mr-1.5 text-amber-500" />
                                        Browse
                                    </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Path shared folder Synology (contoh: <code>/iDesk-Backups</code> atau <code>/volume1/Backups</code>)
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Jadwal Eksekusi Harian</Label>
                                <Input
                                    type="time"
                                    value={formData.scheduleTime}
                                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Retensi (Hari)</Label>
                                <Input
                                    type="number"
                                    value={formData.retentionDays}
                                    onChange={(e) => setFormData({ ...formData, retentionDays: e.target.value })}
                                    placeholder="30"
                                />
                            </div>
                        </div>

                        {/* Synology Structured Storage Info Callout */}
                        <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 p-4 text-xs text-blue-950 dark:text-blue-200 space-y-1.5">
                            <div className="font-semibold flex items-center gap-2 text-blue-800 dark:text-blue-300">
                                <Server className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                Penyimpanan Otomatis ke Synology NAS
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                Data otomatis dikelompokkan ke subfolder terstruktur pada Synology NAS:
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono text-[11px]">{formData.destinationPath || '/iDesk-Backups'}/database/</code> untuk dump riwayat chat & basis data,
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono text-[11px]">{formData.destinationPath || '/iDesk-Backups'}/attachments/</code> untuk lampiran tiket,
                                dan <code className="mx-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono text-[11px]">{formData.destinationPath || '/iDesk-Backups'}/telegram/</code> untuk foto chat bridge.
                                Setiap lampiran baru yang di-upload oleh pengguna akan langsung di-mirror ke Synology di latar belakang secara asinkron.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/40">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleTestConnection}
                                disabled={testing}
                                className="border-slate-300 dark:border-slate-700"
                            >
                                <TestTube className="h-4 w-4 mr-2 text-primary" />
                                {testing ? 'Testing...' : 'Test Connection'}
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingConfigId(null);
                                    }}
                                >
                                    Batal
                                </Button>
                                <Button onClick={handleSaveConfig} className="shadow-sm">
                                    {editingConfigId ? 'Simpan Perubahan' : 'Create Configuration'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Existing Configurations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-primary" />
                        Backup Configurations
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin" />
                        </div>
                    ) : configs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No backup configurations yet. Click "Add Configuration" to create one.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead>Schedule</TableHead>
                                    <TableHead>Last Backup</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {configs.map((config) => (
                                    <TableRow key={config.id}>
                                        <TableCell className="font-medium">{config.name}</TableCell>
                                        <TableCell>
                                            {config.backupType === 'FULL' ? (
                                                <Badge className="bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-mono text-[11px]">
                                                    FULL (DB + Files)
                                                </Badge>
                                            ) : config.backupType === 'DATABASE' ? (
                                                <Badge variant="outline" className="font-mono text-xs border-slate-300 text-slate-700 dark:text-slate-300">
                                                    DATABASE
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="font-mono text-xs border-amber-300 text-amber-700 dark:text-amber-300">
                                                    FILES
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                    {config.synologyHost}:{config.synologyPort}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md">
                                                    <Folder className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
                                                    {config.destinationFolder || '/iDesk-Backups'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{config.scheduleCron || 'Manual'}</TableCell>
                                        <TableCell className="text-xs">
                                            {config.lastBackupAt ? (
                                                formatDistanceToNow(new Date(config.lastBackupAt), {
                                                    addSuffix: true,
                                                    locale: idLocale,
                                                })
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {config.lastBackupStatus ? getStatusBadge(config.lastBackupStatus) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-1 border-primary/40 hover:bg-primary/10 text-primary font-medium shadow-xs"
                                                    onClick={() => handleExecuteBackup(config.id)}
                                                    disabled={executing === config.id}
                                                >
                                                    <Play className="h-3.5 w-3.5" />
                                                    {executing === config.id ? 'Running...' : 'Run Now'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
                                                    onClick={() => openEditForm(config)}
                                                    title="Edit Konfigurasi"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteConfig(config.id)}
                                                    title="Hapus Konfigurasi"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Backup History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Backup History
                    </CardTitle>
                    <CardDescription>Daftar riwayat operasi backup & opsi restore langsung</CardDescription>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Belum ada riwayat backup.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Started</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium text-xs">
                                                {new Date(item.startedAt).toLocaleString('id-ID')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">{item.backupType}</Badge>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell className="text-xs">
                                            {item.fileSizeBytes ? formatBytes(item.fileSizeBytes) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {item.completedAt ? (
                                                `${Math.round((new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 1000)}s`
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.status === 'SUCCESS' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                                    onClick={() => openRestoreFromHistory(item)}
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    Restore
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Folder & File Browser Dialog */}
            <Dialog open={showFolderBrowser} onOpenChange={(open) => !open && handleCloseBrowser()}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Folder className="h-5 w-5 text-amber-500" />
                            {browserMode === 'destination' ? 'Pilih Destination Folder' : 'Pilih File Backup di Synology NAS'}
                        </DialogTitle>
                        <DialogDescription>
                            {browserMode === 'destination'
                                ? 'Browse share/volume di NAS untuk memilih folder tujuan backup'
                                : 'Pilih file backup database (.sql.gz) yang ada di Synology NAS untuk di-restore'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {/* Current path + up button */}
                        <div className="flex items-center gap-2 rounded-lg border bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleNavigateUp}
                                disabled={currentBrowsePath === '/' || browsing}
                            >
                                <ArrowUp className="h-4 w-4 mr-1" />
                                Up
                            </Button>
                            <div className="text-sm font-mono text-muted-foreground truncate flex-1">
                                {currentBrowsePath}
                            </div>
                        </div>

                        {/* List */}
                        <div className="border rounded-lg min-h-[260px] max-h-[360px] overflow-auto bg-white dark:bg-slate-950">
                            {browsing ? (
                                <div className="flex items-center justify-center h-40">
                                    <RefreshCw className="h-5 w-5 animate-spin mr-2 text-primary" />
                                    <span className="text-sm text-muted-foreground">Memuat data dari Synology...</span>
                                </div>
                            ) : folderList.length === 0 ? (
                                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                                    Tidak ada folder atau file backup di lokasi ini
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {folderList.map((item, idx) => {
                                        const isSelected = selectedNasFileForRestore?.path === item.path;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleItemClick(item)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                    isSelected ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500' : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                                                }`}
                                            >
                                                {item.isDir ? (
                                                    <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                                                ) : (
                                                    <Database className="h-4 w-4 text-emerald-500 shrink-0" />
                                                )}
                                                <span className="font-medium text-sm truncate flex-1">{item.name}</span>
                                                {item.size ? (
                                                    <span className="text-xs text-muted-foreground mr-2">{formatBytes(item.size)}</span>
                                                ) : null}
                                                <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                                                    {item.path}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                            {browserMode === 'destination'
                                ? 'Klik folder untuk masuk. Gunakan tombol Up untuk naik satu level.'
                                : 'Klik pada file .sql.gz untuk memilih file yang akan di-restore.'}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={handleCloseBrowser}>
                            Batal
                        </Button>
                        <Button type="button" onClick={handleSelectPath} disabled={browsing}>
                            <Check className="h-4 w-4 mr-1.5" />
                            {browserMode === 'destination'
                                ? `Pilih Folder Ini (${currentBrowsePath})`
                                : selectedNasFileForRestore
                                ? `Pilih File: ${selectedNasFileForRestore.name}`
                                : 'Pilih File Backup'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Restore Hub Dialog */}
            <Dialog open={showRestoreHub} onOpenChange={setShowRestoreHub}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <RotateCcw className="h-5 w-5 text-amber-500" />
                            Pusat Pemulihan Database (Restore Hub)
                        </DialogTitle>
                        <DialogDescription>
                            Pilih sumber backup database iDesk yang ingin Anda pulihkan.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab Navigation */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setRestoreHubTab('history')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                restoreHubTab === 'history'
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            Riwayat Sukses
                        </button>
                        <button
                            type="button"
                            onClick={() => setRestoreHubTab('nas')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                restoreHubTab === 'nas'
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Server className="h-3.5 w-3.5" />
                            Dari Synology NAS
                        </button>
                        <button
                            type="button"
                            onClick={() => setRestoreHubTab('upload')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                restoreHubTab === 'upload'
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Unggah Manual (.sql)
                        </button>
                    </div>

                    {/* Tab 1: Dari Riwayat Backup */}
                    {restoreHubTab === 'history' && (
                        <div className="space-y-4 pt-1">
                            <p className="text-xs text-muted-foreground">
                                Pilih salah satu backup sukses terbaru yang tersimpan dalam sistem:
                            </p>
                            {successfulHistories.length === 0 ? (
                                <div className="p-6 text-center border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm text-muted-foreground">
                                    Belum ada catatan backup database yang berstatus sukses.
                                </div>
                            ) : (
                                <div className="border rounded-lg max-h-[250px] overflow-auto divide-y">
                                    {successfulHistories.map((h) => (
                                        <div
                                            key={h.id}
                                            className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                        >
                                            <div>
                                                <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                                    {new Date(h.startedAt).toLocaleString('id-ID')}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    Tipe: {h.backupType} • Ukuran: {formatBytes(h.fileSizeBytes || 0)}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 gap-1 text-xs"
                                                onClick={() => {
                                                    setShowRestoreHub(false);
                                                    openRestoreFromHistory(h);
                                                }}
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                                Pilih
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Dari Synology NAS */}
                    {restoreHubTab === 'nas' && (
                        <div className="space-y-4 pt-1">
                            <div className="space-y-2">
                                <Label className="text-xs">Pilih Konfigurasi Synology NAS</Label>
                                <Select
                                    value={activeRestoreConfigId}
                                    onValueChange={setActiveRestoreConfigId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih konfigurasi Synology" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {configs.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} ({c.synologyHost}:{c.synologyPort})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-xs">Jelajahi File di NAS</div>
                                    <div className="text-[11px] text-muted-foreground">
                                        Buka file browser untuk memilih file .sql.gz di folder NAS
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={openNasFileBrowserForRestore}
                                    disabled={!activeRestoreConfigId}
                                    className="gap-1.5"
                                >
                                    <Folder className="h-4 w-4 text-amber-400" />
                                    Browse File NAS
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Upload File Manual */}
                    {restoreHubTab === 'upload' && (
                        <div className="space-y-4 pt-1">
                            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                <div>
                                    <label
                                        htmlFor="restore-file-upload"
                                        className="cursor-pointer font-medium text-primary hover:underline text-sm"
                                    >
                                        Pilih file backup (.sql.gz / .sql)
                                    </label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Format terkompresi .sql.gz atau file SQL polos (maks. 500MB)
                                    </p>
                                </div>
                                <input
                                    id="restore-file-upload"
                                    type="file"
                                    accept=".gz,.sql,.sql.gz"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setUploadedFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                {uploadedFile && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                                        <FileText className="h-4 w-4" />
                                        <span>{uploadedFile.name} ({formatBytes(uploadedFile.size)})</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    disabled={!uploadedFile}
                                    onClick={() => {
                                        setShowRestoreHub(false);
                                        setRestoreType('upload');
                                        setConfirmInputText('');
                                        setShowRestoreConfirm(true);
                                    }}
                                    className="gap-1.5"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Lanjut ke Konfirmasi Restore
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Safety Confirmation Dialog */}
            <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
                <DialogContent className="max-w-lg border-rose-500/30">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="h-5 w-5" />
                            Konfirmasi Pemulihan Database
                        </DialogTitle>
                        <DialogDescription>
                            Tindakan ini akan menimpa database aktif saat ini dengan data dari file backup.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Warning Box */}
                        <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
                            <div className="font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="h-4 w-4" />
                                PERHATIAN TINGGI
                            </div>
                            <p>
                                Seluruh data tiket, log audit, dan perubahan yang dibuat setelah waktu backup ini akan ditimpa dan digantikan dengan data dari backup yang dipilih.
                            </p>
                        </div>

                        {/* Details */}
                        <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 text-xs space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Sumber Backup:</span>
                                <span className="font-medium capitalize">{restoreType}</span>
                            </div>
                            {restoreType === 'history' && selectedHistoryItem && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Waktu Backup:</span>
                                        <span className="font-medium">{new Date(selectedHistoryItem.startedAt).toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ukuran:</span>
                                        <span className="font-medium">{formatBytes(selectedHistoryItem.fileSizeBytes || 0)}</span>
                                    </div>
                                </>
                            )}
                            {restoreType === 'nas' && selectedNasFileForRestore && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">File NAS:</span>
                                    <span className="font-medium font-mono text-[11px] truncate max-w-[240px]">{selectedNasFileForRestore.name}</span>
                                </div>
                            )}
                            {restoreType === 'upload' && uploadedFile && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">File Upload:</span>
                                    <span className="font-medium text-[11px]">{uploadedFile.name} ({formatBytes(uploadedFile.size)})</span>
                                </div>
                            )}
                        </div>

                        {/* Snapshot Toggle */}
                        <div className="flex items-center space-x-2 pt-1">
                            <input
                                type="checkbox"
                                id="create-snapshot"
                                checked={createSnapshot}
                                onChange={(e) => setCreateSnapshot(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="create-snapshot" className="text-xs font-medium cursor-pointer">
                                Buat snapshot backup otomatis sebelum me-restore (Disarankan)
                            </label>
                        </div>

                        {/* Verification Input */}
                        <div className="space-y-1.5 pt-2">
                            <Label className="text-xs text-muted-foreground">
                                Ketik <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">RESTORE</span> untuk mengaktifkan tombol:
                            </Label>
                            <Input
                                value={confirmInputText}
                                onChange={(e) => setConfirmInputText(e.target.value)}
                                placeholder="RESTORE"
                                className="font-mono text-center tracking-widest uppercase font-bold"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 pt-3 border-t border-border/40">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setShowRestoreConfirm(false);
                                setConfirmInputText('');
                            }}
                            disabled={restoring}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmRestore}
                            disabled={confirmInputText !== 'RESTORE' || restoring}
                            className="gap-1.5 shadow-sm"
                        >
                            {restoring ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                                    Sedang Memulihkan Database...
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-4 w-4 mr-1.5" />
                                    Konfirmasi & Mulai Restore
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
