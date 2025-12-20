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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface BackupConfig {
    id: string;
    name: string;
    synologyHost: string;
    synologyPort: number;
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
    fileSizeBytes: number | null;
    errorMessage: string | null;
}

export default function SynologyBackupSettings() {
    const [configs, setConfigs] = useState<BackupConfig[]>([]);
    const [history, setHistory] = useState<BackupHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [executing, setExecuting] = useState<string | null>(null);

    // New config form
    const [showForm, setShowForm] = useState(false);
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

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [configRes, historyRes] = await Promise.all([
                fetch('/api/backup/configs', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                }),
                fetch('/api/backup/history?limit=20', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                }),
            ]);

            if (configRes.ok) setConfigs(await configRes.json());
            if (historyRes.ok) setHistory(await historyRes.json());
        } catch (error) {
            toast.error('Failed to load backup data');
        } finally {
            setLoading(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const response = await fetch('/api/backup/test-connection', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    synologyHost: formData.synologyHost,
                    synologyPort: parseInt(formData.synologyPort),
                    synologyUsername: formData.synologyUsername,
                    synologyPassword: formData.synologyPassword,
                }),
            });

            const result = await response.json();
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error('Connection test failed');
        } finally {
            setTesting(false);
        }
    };

    const handleCreateConfig = async () => {
        try {
            const response = await fetch('/api/backup/configs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.name,
                    synologyHost: formData.synologyHost,
                    synologyPort: parseInt(formData.synologyPort),
                    synologyUsername: formData.synologyUsername,
                    synologyPassword: formData.synologyPassword,
                    destinationPath: formData.destinationPath,
                    backupType: formData.backupType,
                    scheduleTime: formData.scheduleTime,
                    retentionDays: parseInt(formData.retentionDays),
                }),
            });

            if (response.ok) {
                toast.success('Backup configuration created');
                setShowForm(false);
                fetchData();
            } else {
                toast.error('Failed to create configuration');
            }
        } catch (error) {
            toast.error('Failed to create configuration');
        }
    };

    const handleExecuteBackup = async (configId: string) => {
        setExecuting(configId);
        try {
            const response = await fetch(`/api/backup/execute/${configId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });

            if (response.ok) {
                toast.success('Backup started');
                fetchData();
            } else {
                toast.error('Failed to start backup');
            }
        } catch (error) {
            toast.error('Failed to start backup');
        } finally {
            setExecuting(null);
        }
    };

    const handleDeleteConfig = async (configId: string) => {
        try {
            const response = await fetch(`/api/backup/configs/${configId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });

            if (response.ok) {
                toast.success('Configuration deleted');
                fetchData();
            }
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
            case 'FAILED':
                return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
            case 'RUNNING':
                return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Synology NAS Backup</h2>
                    <p className="text-sm text-muted-foreground">Configure automatic backups to Synology NAS (RS1221)</p>
                </div>
                <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Configuration
                </Button>
            </div>

            {/* New Config Form */}
            {showForm && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            New Backup Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Configuration Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Daily Database Backup"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Backup Type</Label>
                                <Select
                                    value={formData.backupType}
                                    onValueChange={(val) => setFormData({ ...formData, backupType: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DATABASE">Database Only</SelectItem>
                                        <SelectItem value="FILES">Files Only</SelectItem>
                                        <SelectItem value="FULL">Full Backup</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Synology Host</Label>
                                <Input
                                    value={formData.synologyHost}
                                    onChange={(e) => setFormData({ ...formData, synologyHost: e.target.value })}
                                    placeholder="192.168.1.100 or nas.company.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Port</Label>
                                <Input
                                    value={formData.synologyPort}
                                    onChange={(e) => setFormData({ ...formData, synologyPort: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Username</Label>
                                <Input
                                    value={formData.synologyUsername}
                                    onChange={(e) => setFormData({ ...formData, synologyUsername: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input
                                    type="password"
                                    value={formData.synologyPassword}
                                    onChange={(e) => setFormData({ ...formData, synologyPassword: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Destination Folder</Label>
                                <Input
                                    value={formData.destinationPath}
                                    onChange={(e) => setFormData({ ...formData, destinationPath: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Schedule Time</Label>
                                <Input
                                    type="time"
                                    value={formData.scheduleTime}
                                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Retention (days)</Label>
                                <Input
                                    type="number"
                                    value={formData.retentionDays}
                                    onChange={(e) => setFormData({ ...formData, retentionDays: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                                <TestTube className="h-4 w-4 mr-2" />
                                {testing ? 'Testing...' : 'Test Connection'}
                            </Button>
                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button onClick={handleCreateConfig}>Create Configuration</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Existing Configurations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5" />
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
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {configs.map((config) => (
                                    <TableRow key={config.id}>
                                        <TableCell className="font-medium">{config.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{config.backupType}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {config.synologyHost}:{config.synologyPort}
                                        </TableCell>
                                        <TableCell>{config.scheduleCron || 'Manual'}</TableCell>
                                        <TableCell>
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
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleExecuteBackup(config.id)}
                                                    disabled={executing === config.id}
                                                >
                                                    <Play className="h-4 w-4 mr-1" />
                                                    {executing === config.id ? 'Running...' : 'Run Now'}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive"
                                                    onClick={() => handleDeleteConfig(config.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
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
                    <CardDescription>Recent backup operations</CardDescription>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No backup history yet.
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            {new Date(item.startedAt).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell>{item.backupType}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell>
                                            {item.fileSizeBytes ? formatBytes(item.fileSizeBytes) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {item.completedAt ? (
                                                `${Math.round((new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 1000)}s`
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
