import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
    Volume2,
    VolumeX,
    Upload,
    Play,
    Trash2,
    RefreshCw,
    Music,
    CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useSoundNotification, type NotificationEventType } from '@/hooks/useSoundNotification';
import { cn } from '@/lib/utils';

interface NotificationSound {
    id: string;
    eventType: NotificationEventType | string;
    soundName: string;
    soundUrl: string;
    isDefault: boolean;
    isActive: boolean;
}

const EVENT_TYPE_CONFIG: Record<
    NotificationEventType,
    { label: string; desc: string; color: string; bg: string; border: string }
> = {
    NEW_TICKET: {
        label: 'Tiket Baru',
        desc: 'Diputar saat ada tiket atau permohonan baru masuk ke sistem',
        color: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
    },
    MESSAGE: {
        label: 'Pesan Baru',
        desc: 'Diputar saat ada komentar / pesan balasan baru pada tiket',
        color: 'text-purple-700 dark:text-purple-300',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
    },
    ASSIGNED: {
        label: 'Tiket Ditugaskan',
        desc: 'Diputar saat tiket di-assign kepada staf atau teknisi Anda',
        color: 'text-indigo-700 dark:text-indigo-300',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/20',
    },
    RESOLVED: {
        label: 'Tiket Selesai',
        desc: 'Diputar saat tiket selesai ditangani atau instalasi dikonfirmasi',
        color: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
    },
    CRITICAL: {
        label: 'Alert Critical',
        desc: 'Diputar saat ada insiden prioritas Emergency / Critical',
        color: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
    },
    SLA_WARNING: {
        label: 'SLA Warning',
        desc: 'Diputar saat waktu penanganan mendekati batas waktu SLA',
        color: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
    },
    SLA_BREACH: {
        label: 'SLA Breach',
        desc: 'Diputar saat tiket melewati batas waktu respon/penyelesaian SLA',
        color: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
    },
};

export const SoundSettingsPage: React.FC = () => {
    const [sounds, setSounds] = useState<NotificationSound[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedUploadEvent, setSelectedUploadEvent] = useState<NotificationEventType>('NEW_TICKET');
    const [customName, setCustomName] = useState('');
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        enabled,
        volume,
        setEnabled,
        setVolume,
        testSound,
        previewSoundUrl,
        clearCache,
    } = useSoundNotification();

    useEffect(() => {
        fetchSounds();
    }, []);

    const fetchSounds = async () => {
        setLoading(true);
        try {
            const response = await api.get<NotificationSound[]>('/sounds');
            if (response.data) {
                setSounds(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch notification sounds:', error);
            toast.error('Gagal memuat daftar nada dering notifikasi');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            toast.error('Pilih file audio terlebih dahulu');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 5MB');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('eventType', selectedUploadEvent);
            if (customName.trim()) {
                formData.append('name', customName.trim());
            }

            await api.post('/sounds/upload', formData);

            toast.success('File suara kustom berhasil diunggah!');
            clearCache();
            setCustomName('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            await fetchSounds();
        } catch (error: any) {
            console.error('Upload sound error:', error);
            toast.error(error.response?.data?.message || 'Gagal mengunggah file suara kustom');
        } finally {
            setUploading(false);
        }
    };

    const handleSetActive = async (eventType: NotificationEventType, soundId: string) => {
        try {
            await api.post(`/sounds/set-active/${eventType}`, { soundId });
            toast.success('Suara aktif untuk event berhasil diperbarui');
            clearCache();
            await fetchSounds();
        } catch (error) {
            console.error('Failed to set active sound:', error);
            toast.error('Gagal memperbarui suara aktif');
        }
    };

    const handleDelete = async (soundId: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus suara kustom ini?')) {
            return;
        }

        try {
            await api.delete(`/sounds/${soundId}`);
            toast.success('Suara kustom berhasil dihapus');
            clearCache();
            await fetchSounds();
        } catch (error: any) {
            console.error('Delete sound error:', error);
            toast.error(error.response?.data?.message || 'Gagal menghapus suara');
        }
    };

    const handlePlayPreview = async (url: string) => {
        setPlayingUrl(url);
        await previewSoundUrl(url);
        setTimeout(() => {
            setPlayingUrl(null);
        }, 2000);
    };

    // Group sounds by event type (case-insensitive & separator-tolerant match)
    const groupedSounds = (Object.keys(EVENT_TYPE_CONFIG) as NotificationEventType[]).reduce(
        (acc, eventType) => {
            const normalizedKey = eventType.toLowerCase().replace(/[-\s]/g, '_');
            acc[eventType] = sounds.filter((s) => {
                const sType = String(s.eventType || '').toLowerCase().replace(/[-\s]/g, '_');
                return sType === normalizedKey;
            });
            return acc;
        },
        {} as Record<NotificationEventType, NotificationSound[]>
    );

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Sound Settings & Notifications
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Atur volume, dengarkan preview, pilih nada dering default, atau unggah audio kustom Anda sendiri.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        clearCache();
                        fetchSounds();
                        toast.success('Cache suara disegarkan');
                    }}
                    className="gap-2 self-start sm:self-auto rounded-xl"
                >
                    <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                    <span>Segarkan Suara</span>
                </Button>
            </div>

            {/* ── CARD 1: MASTER PREFERENCES ── */}
            <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800 dark:text-white">
                        <div className="size-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            {enabled ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5" />}
                        </div>
                        <span>Preferensi Master Audio</span>
                    </CardTitle>
                    <CardDescription>
                        Kontrol saklar suara dan volume pemutaran nada notifikasi di peramban Anda.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Toggle */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                Aktifkan Notifikasi Suara
                            </Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Bunyikan nada dering saat ada tiket masuk, pesan baru, atau eskalasi SLA.
                            </p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    {/* Volume Slider */}
                    <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="flex items-center gap-1.5">
                                <Volume2 className="size-3.5 text-primary" />
                                <span>Tingkat Volume: {Math.round(volume * 100)}%</span>
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => testSound('NEW_TICKET')}
                                disabled={!enabled}
                                className="h-8 gap-1.5 rounded-xl text-xs font-bold shadow-2xs cursor-pointer active:scale-95"
                            >
                                <Play className="size-3.5" />
                                <span>Tes Suara Notifikasi</span>
                            </Button>
                        </div>
                        <Slider
                            value={[volume * 100]}
                            onValueChange={([val]) => setVolume(val / 100)}
                            max={100}
                            step={5}
                            disabled={!enabled}
                            className="cursor-pointer"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ── CARD 2: NOTIFICATION SOUNDS LIBRARY ── */}
            <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800 dark:text-white">
                        <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Music className="size-4.5" />
                        </div>
                        <span>Pustaka Nada Dering Notifikasi</span>
                    </CardTitle>
                    <CardDescription>
                        Pilih nada default atau kustom yang aktif untuk setiap jenis event pemberitahuan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <RefreshCw className="size-8 animate-spin text-primary" />
                            <span className="text-xs font-semibold">Memuat daftar nada dering...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <TableRow className="border-slate-100 dark:border-slate-800">
                                        <TableHead className="font-bold text-xs uppercase tracking-wider">Jenis Event</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider">Nama Suara</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider">Tipe</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-right pr-6">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(Object.keys(EVENT_TYPE_CONFIG) as NotificationEventType[]).map((eventType) => {
                                        const eventCfg = EVENT_TYPE_CONFIG[eventType];
                                        const eventSounds = groupedSounds[eventType] || [];

                                        if (eventSounds.length === 0) {
                                            return (
                                                <TableRow key={eventType} className="border-slate-100 dark:border-slate-800">
                                                    <TableCell className="font-bold text-xs">
                                                        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border', eventCfg.bg, eventCfg.color, eventCfg.border)}>
                                                            {eventCfg.label}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell colSpan={3} className="text-xs text-muted-foreground italic">
                                                        Menggunakan default built-in
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => testSound(eventType)}
                                                            className="gap-1 text-xs font-bold"
                                                        >
                                                            <Play className="size-3.5" />
                                                            <span>Tes</span>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return eventSounds.map((sound, idx) => (
                                            <TableRow key={sound.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                {idx === 0 && (
                                                    <TableCell rowSpan={eventSounds.length} className="align-top pt-4 font-bold text-xs">
                                                        <div className="space-y-1">
                                                            <span className={cn('inline-block px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs', eventCfg.bg, eventCfg.color, eventCfg.border)}>
                                                                {eventCfg.label}
                                                            </span>
                                                            <p className="text-[11px] text-muted-foreground font-normal max-w-[180px] leading-tight">
                                                                {eventCfg.desc}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                )}

                                                {/* Sound Name */}
                                                <TableCell className="font-medium text-xs text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn('font-semibold', sound.isActive && 'font-bold text-foreground')}>
                                                            {sound.soundName}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* Type Badge */}
                                                <TableCell>
                                                    {sound.isDefault ? (
                                                        <Badge variant="secondary" className="text-[10px] font-bold">Default</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] font-bold border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                                                            Custom Upload
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                {/* Status Badge */}
                                                <TableCell className="text-center">
                                                    {sound.isActive ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                                            <CheckCircle2 className="size-3" />
                                                            <span>Aktif</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                                            <span>Nonaktif</span>
                                                        </span>
                                                    )}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Play Preview */}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handlePlayPreview(sound.soundUrl)}
                                                            className={cn(
                                                                'size-8 rounded-xl cursor-pointer transition-transform active:scale-90',
                                                                playingUrl === sound.soundUrl && 'text-primary animate-pulse'
                                                            )}
                                                            title="Dengarkan Suara Ini"
                                                        >
                                                            <Play className="size-4" />
                                                        </Button>

                                                        {/* Set Active */}
                                                        {!sound.isActive && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleSetActive(eventType, sound.id)}
                                                                className="h-8 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 hover:border-primary/50"
                                                            >
                                                                Pilih Suara
                                                            </Button>
                                                        )}

                                                        {/* Delete Custom Sound */}
                                                        {!sound.isDefault && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                                onClick={() => handleDelete(sound.id)}
                                                                title="Hapus Suara Kustom"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ));
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── CARD 3: UPLOAD CUSTOM SOUND ── */}
            <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800 dark:text-white">
                        <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Upload className="size-4.5" />
                        </div>
                        <span>Upload Custom Sound Manual</span>
                    </CardTitle>
                    <CardDescription>
                        Unggah file suara Anda sendiri (Format: MP3, WAV, OGG, M4A, AAC — Maks. 5MB).
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Target Event Selector */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground">
                                    Target Notifikasi Event
                                </Label>
                                <select
                                    value={selectedUploadEvent}
                                    onChange={(e) => setSelectedUploadEvent(e.target.value as NotificationEventType)}
                                    className="w-full h-10 px-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                                >
                                    {(Object.keys(EVENT_TYPE_CONFIG) as NotificationEventType[]).map((eventType) => (
                                        <option key={eventType} value={eventType}>
                                            {EVENT_TYPE_CONFIG[eventType].label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom Label Name */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground">
                                    Nama Suara (Opsional)
                                </Label>
                                <Input
                                    type="text"
                                    placeholder="Contoh: Chime Futuristik"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    className="h-10 text-xs rounded-xl"
                                />
                            </div>
                        </div>

                        {/* File Input */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground">
                                Pilih File Audio
                            </Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
                                disabled={uploading}
                                className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border border-border rounded-xl p-1 bg-card"
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-muted-foreground">
                                Setelah diunggah, suara akan otomatis muncul di tabel di atas dan dapat diaktifkan.
                            </span>
                            <Button
                                type="submit"
                                disabled={uploading}
                                className="gap-2 rounded-xl text-xs font-bold px-5 shadow-xs active:scale-95 cursor-pointer"
                            >
                                <Upload className="size-3.5" />
                                <span>{uploading ? 'Mengunggah...' : 'Upload & Simpan'}</span>
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default SoundSettingsPage;
