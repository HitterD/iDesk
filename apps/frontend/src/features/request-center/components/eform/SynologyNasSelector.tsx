import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server,
  Folder,
  Plus,
  Trash2,
  Eye,
  FileEdit,
  UploadCloud,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
  HardDrive,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { NasFolderRequestItem } from '../../api/eform-request.api';

export function getParentPaths(folderPath: string): string[] {
  const normalized = folderPath.trim().replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  const parents: string[] = [];
  while (parts.length > 1) {
    parts.pop();
    parents.push('/' + parts.join('/'));
  }
  return parents;
}

export interface SynologyNasSelectorProps {
  selectedServers: Array<'JKT' | 'KRW' | 'SMG' | 'SPJ'>;
  onSelectedServersChange: (servers: Array<'JKT' | 'KRW' | 'SMG' | 'SPJ'>) => void;
  selections: NasFolderRequestItem[];
  onSelectionsChange: (items: NasFolderRequestItem[]) => void;
  screenshots?: string[];
  onScreenshotsChange?: (screenshots: string[]) => void;
}

export const SYNOLOGY_SERVERS_CONFIG = [
  {
    id: 'JKT' as const,
    name: 'Synology JKT',
    title: 'Jakarta (JKT)',
    location: 'Jakarta',
    host: '10.11.2.6',
    port: 30001,
    badgeColor: 'text-sky-700 bg-sky-500/10 border-sky-500/30 dark:text-sky-400',
  },
  {
    id: 'KRW' as const,
    name: 'Synology KRW',
    title: 'Karawang (KRW)',
    location: 'Karawang',
    host: '10.12.2.6',
    port: 30001,
    badgeColor: 'text-indigo-700 bg-indigo-500/10 border-indigo-500/30 dark:text-indigo-400',
  },
  {
    id: 'SMG' as const,
    name: 'Synology SMG',
    title: 'Semarang (SMG)',
    location: 'Semarang',
    host: '10.14.2.16',
    port: 30001,
    badgeColor: 'text-amber-700 bg-amber-500/10 border-amber-500/30 dark:text-amber-400',
  },
  {
    id: 'SPJ' as const,
    name: 'Synology SPJ',
    title: 'Sepanjang (SPJ)',
    location: 'Sepanjang',
    host: '192.168.2.16',
    port: 30001,
    badgeColor: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-400',
  },
];

export const SynologyNasSelector: React.FC<SynologyNasSelectorProps> = ({
  selectedServers,
  onSelectedServersChange,
  selections,
  onSelectionsChange,
  screenshots = [],
  onScreenshotsChange,
}) => {
  // Target server for new manual path (defaults to first selected server or SPJ)
  const [activeServerId, setActiveServerId] = useState<'JKT' | 'KRW' | 'SMG' | 'SPJ'>(
    selectedServers[0] || 'SPJ'
  );
  const [manualPath, setManualPath] = useState('');
  const [manualAccessLevel, setManualAccessLevel] = useState<'READ_ONLY' | 'READ_WRITE'>('READ_ONLY');
  const [isManualFormOpen, setIsManualFormOpen] = useState(true);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox preview for screenshots
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Keep activeServerId aligned with selected servers if current one gets unselected
  useEffect(() => {
    if (selectedServers.length > 0 && !selectedServers.includes(activeServerId)) {
      setActiveServerId(selectedServers[0]);
    }
  }, [selectedServers, activeServerId]);

  // Toggle server selection
  const handleToggleServer = (serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ') => {
    if (selectedServers.includes(serverId)) {
      if (selectedServers.length === 1) {
        toast.warning('Minimal satu lokasi server Synology harus dipilih.');
        return;
      }
      onSelectedServersChange(selectedServers.filter(s => s !== serverId));
    } else {
      onSelectedServersChange([...selectedServers, serverId]);
      setActiveServerId(serverId);
    }
  };

  // Add manual folder
  const handleAddManualFolder = () => {
    const trimmedPath = manualPath.trim();
    if (!trimmedPath) {
      toast.error('Ketik path atau nama direktori folder terlebih dahulu');
      return;
    }

    const serverConfig = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === activeServerId);
    if (!serverConfig) return;

    // Check duplicate
    const exists = selections.some(
      s => s.nasId === activeServerId && s.folderPath.toLowerCase() === trimmedPath.toLowerCase()
    );
    if (exists) {
      toast.warning(`Folder "${trimmedPath}" sudah ada di daftar server ${activeServerId}.`);
      return;
    }

    // Ensure server is in selectedServers
    if (!selectedServers.includes(activeServerId)) {
      onSelectedServersChange([...selectedServers, activeServerId]);
    }

    const newItem: NasFolderRequestItem = {
      nasId: activeServerId,
      nasName: serverConfig.name,
      folderPath: trimmedPath,
      accessLevel: manualAccessLevel,
      isManualInput: true,
    };

    onSelectionsChange([...selections, newItem]);
    setManualPath('');
    toast.success(`Folder berhasil ditambahkan ke daftar ${serverConfig.title}`);
  };

  // Remove selection
  const handleRemoveSelection = (index: number) => {
    onSelectionsChange(selections.filter((_, idx) => idx !== index));
  };

  // Update access level
  const handleUpdateAccessLevel = (index: number, level: 'READ_ONLY' | 'READ_WRITE') => {
    const updated = [...selections];
    updated[index] = { ...updated[index], accessLevel: level };
    onSelectionsChange(updated);
  };

  // Bulk update access level
  const handleBulkAccessLevel = (level: 'READ_ONLY' | 'READ_WRITE') => {
    const updated = selections.map(s => ({ ...s, accessLevel: level }));
    onSelectionsChange(updated);
    toast.info(`Hak akses semua folder diubah menjadi ${level === 'READ_WRITE' ? 'Read & Write' : 'Read Only'}`);
  };

  // Upload handler for files
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Validate count (max 5)
    if (screenshots.length + fileArray.length > 5) {
      toast.error('Maksimal lampiran screenshot adalah 5 gambar.');
      return;
    }

    // Validate size (max 5MB) & type
    for (const f of fileArray) {
      if (!f.type.startsWith('image/')) {
        toast.error(`Berkas "${f.name}" bukan gambar. Hanya format gambar yang diizinkan.`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`Berkas "${f.name}" melebihi ukuran maksimum 5MB.`);
        return;
      }
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      fileArray.forEach(file => {
        formData.append('files', file);
      });

      const res = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && Array.isArray(res.data.urls)) {
        const newUrls = [...screenshots, ...res.data.urls];
        onScreenshotsChange?.(newUrls);
        toast.success(`${res.data.urls.length} screenshot berhasil diunggah.`);
      } else {
        toast.error('Gagal mengunggah screenshot.');
      }
    } catch {
      toast.error('Terjadi kesalahan saat mengunggah screenshot.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove screenshot
  const handleRemoveScreenshot = (index: number) => {
    const updated = screenshots.filter((_, idx) => idx !== index);
    onScreenshotsChange?.(updated);
    toast.info('Screenshot dihapus dari lampiran.');
  };

  // Global paste handler when focused in this container
  const containerRef = useRef<HTMLDivElement>(null);
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleUploadFiles(imageFiles);
      }
    },
    [screenshots]
  );

  return (
    <div
      ref={containerRef}
      onPaste={handlePaste}
      tabIndex={0}
      className="space-y-6 focus:outline-hidden"
    >
      {/* 1. Pemilihan Server Cabang Synology NAS */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Lokasi Server Synology NAS <span className="text-destructive">*</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pilih satu atau beberapa lokasi server NAS tempat folder tujuan berada
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => onSelectedServersChange(['JKT', 'KRW', 'SMG', 'SPJ'])}
              className="text-primary hover:underline font-semibold cursor-pointer text-[11px]"
            >
              Pilih Semua Cabang
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={() => onSelectedServersChange(['SPJ'])}
              className="text-muted-foreground hover:text-foreground font-medium cursor-pointer text-[11px]"
            >
              Reset ke Default
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {SYNOLOGY_SERVERS_CONFIG.map(server => {
            const isSelected = selectedServers.includes(server.id);

            return (
              <button
                key={server.id}
                type="button"
                onClick={() => handleToggleServer(server.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer select-none relative',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                    : 'border-border/80 bg-background hover:border-border hover:bg-muted/40'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {server.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {server.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {server.location} ({server.host})
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle2 size={16} className="text-primary shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Formulir Input Path Manual Folder */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Folder size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Input Path Folder Manual
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Masukkan path spesifik folder yang ingin Anda mintakan hak aksesnya
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsManualFormOpen(true)}
            className="h-8 px-2 text-xs text-primary font-semibold hover:bg-primary/10 cursor-pointer"
          >
            <Plus size={13} className="mr-1" />
            <span>Input Path Manual</span>
          </Button>
        </div>

        {isManualFormOpen && (
          <div className="space-y-4 pt-1 border-t border-border/60">
            {/* Lokasi NAS selector pill */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Pilih Server NAS untuk Folder Ini:
              </label>
              <div className="flex flex-wrap gap-2">
                {SYNOLOGY_SERVERS_CONFIG.filter(s => selectedServers.includes(s.id)).map(s => {
                  const isActive = activeServerId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveServerId(s.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                          : 'border-border/80 bg-background text-foreground hover:bg-muted'
                      )}
                    >
                      <Server size={12} />
                      <span>{s.name} ({s.location})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Text Path */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Direktori / Path Folder <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    value={manualPath}
                    onChange={e => setManualPath(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualFolder();
                      }
                    }}
                    placeholder="Contoh: /Sharing/Dept_Keuangan atau Data_Arsip_2026 atau \\192.168.2.16\sja\Departemen"
                    className="h-10 pl-3 rounded-xl bg-background font-mono text-xs border-border/80 focus-visible:ring-primary shadow-xs"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddManualFolder}
                  className="h-10 px-4 rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs"
                >
                  <Plus size={14} className="mr-1.5" />
                  Tambah Folder
                </Button>
              </div>
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                <Info size={12} className="shrink-0 text-primary mt-0.5" />
                <span>
                  Bisa menggunakan format UNC Windows (contoh: <code className="font-mono text-foreground font-semibold bg-muted px-1 py-0.5 rounded">\\192.168.2.16\sja\Dept_ICT</code>) atau format path Synology (contoh: <code className="font-mono text-foreground font-semibold bg-muted px-1 py-0.5 rounded">/sja/Dept_ICT</code>).
                </span>
              </div>
            </div>

            {/* Tingkat Hak Akses Default untuk Folder Baru */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Tingkat Hak Akses:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualAccessLevel('READ_ONLY')}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                    manualAccessLevel === 'READ_ONLY'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border/80 bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs">
                    <Eye size={14} /> Read Only (Hanya Baca)
                  </span>
                  {manualAccessLevel === 'READ_ONLY' && <Check size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => setManualAccessLevel('READ_WRITE')}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                    manualAccessLevel === 'READ_WRITE'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border/80 bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs">
                    <FileEdit size={14} /> Read &amp; Write (Baca &amp; Tulis)
                  </span>
                  {manualAccessLevel === 'READ_WRITE' && <Check size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Tabel Rangkuman Folder Terpilih */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Daftar Folder yang Diajukan ({selections.length} folder)
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Folder manual yang akan diproses izinnya oleh tim ICT
            </p>
          </div>

          {selections.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground">Terapkan semua:</span>
              <button
                type="button"
                onClick={() => handleBulkAccessLevel('READ_ONLY')}
                className="px-2 py-0.5 rounded border border-border/80 bg-background hover:bg-muted text-[11px] font-semibold text-foreground transition-colors cursor-pointer"
              >
                Read Only
              </button>
              <button
                type="button"
                onClick={() => handleBulkAccessLevel('READ_WRITE')}
                className="px-2 py-0.5 rounded border border-border/80 bg-background hover:bg-muted text-[11px] font-semibold text-foreground transition-colors cursor-pointer"
              >
                Read &amp; Write
              </button>
            </div>
          )}
        </div>

        {selections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center space-y-1.5">
            <HardDrive size={24} className="mx-auto text-muted-foreground/60" />
            <p className="text-xs font-semibold text-foreground">
              Belum ada folder manual yang ditambahkan
            </p>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              Gunakan formulir di atas untuk menambahkan path folder, atau lampirkan gambar tangkapan layar (screenshot) di bagian bawah.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/70 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3 w-28">Lokasi NAS</th>
                    <th className="py-2.5 px-3">Direktori / Path Folder</th>
                    <th className="py-2.5 px-3 w-44">Tingkat Hak Akses</th>
                    <th className="py-2.5 px-3 w-14 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {selections.map((item, idx) => {
                    const serverConfig = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === item.nasId);

                    return (
                      <tr key={`${item.nasId}-${item.folderPath}-${idx}`} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] border',
                              serverConfig?.badgeColor || 'bg-muted text-foreground'
                            )}
                          >
                            <Server size={11} /> {item.nasId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                            <Folder size={14} className="text-amber-500 shrink-0" />
                            <span className="truncate max-w-xs sm:max-w-md">{item.folderPath}</span>
                            {item.isManualInput && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0 font-sans font-medium">
                                Manual
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="inline-flex rounded-lg border border-border/80 p-0.5 bg-background">
                            <button
                              type="button"
                              onClick={() => handleUpdateAccessLevel(idx, 'READ_ONLY')}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                                item.accessLevel === 'READ_ONLY'
                                  ? 'bg-primary text-primary-foreground shadow-2xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                              title="Hanya Baca"
                            >
                              <Eye size={12} />
                              <span>Read Only</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateAccessLevel(idx, 'READ_WRITE')}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                                item.accessLevel === 'READ_WRITE'
                                  ? 'bg-primary text-primary-foreground shadow-2xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                              title="Baca & Tulis"
                            >
                              <FileEdit size={12} />
                              <span>Read &amp; Write</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveSelection(idx)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Hapus folder ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. Area Unggah Screenshot Bukti Folder */}
      <div className="space-y-3 pt-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Unggah Screenshot Bukti Folder <span className="text-[11px] font-normal lowercase text-muted-foreground">(opsional)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Lampirkan tangkapan layar tampilan Windows Explorer atau folder yang diinginkan untuk memudahkan tim ICT
          </p>
        </div>

        {/* Dropzone container */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={e => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              handleUploadFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all select-none',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files) {
                handleUploadFiles(e.target.files);
              }
            }}
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
              {isUploading ? (
                <Loader2 size={24} className="animate-spin text-primary" />
              ) : (
                <UploadCloud size={24} />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                {isUploading ? 'Sedang mengunggah screenshot...' : 'Tarik & letakkan screenshot di sini, atau klik untuk memilih gambar'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Dukungan format PNG, JPG, WebP. Maksimal 5 file, maks 5MB per file.
              </p>
              <p className="text-[10px] text-primary/80 font-mono mt-1">
                Tip: Anda dapat langsung menekan tombol Ctrl + V untuk paste tangkapan layar dari clipboard
              </p>
            </div>
          </div>
        </div>

        {/* Screenshot Thumbnails List */}
        {screenshots.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon size={14} className="text-primary" />
                <span>Screenshot Terlampir ({screenshots.length}/5)</span>
              </span>
              <span className="text-[11px] text-muted-foreground">Klik gambar untuk memperbesar</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {screenshots.map((url, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-video rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs hover:border-primary/50 transition-all"
                >
                  <img
                    src={url}
                    alt={`Screenshot ${idx + 1}`}
                    onClick={() => setPreviewImage(url)}
                    className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleRemoveScreenshot(idx);
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white hover:bg-destructive hover:text-white transition-colors cursor-pointer"
                    title="Hapus screenshot"
                  >
                    <X size={12} />
                  </button>
                  <div
                    onClick={() => setPreviewImage(url)}
                    className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[10px] text-white/90 font-mono truncate cursor-pointer"
                  >
                    Bukti #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Dialog Modal */}
      <Dialog open={!!previewImage} onOpenChange={open => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl w-full p-4 rounded-2xl bg-card">
          <DialogHeader className="border-b border-border/60 pb-2">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ImageIcon className="text-primary h-4 w-4" />
              <span>Pratinjau Screenshot Folder</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 max-h-[75vh] overflow-auto">
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview screenshot folder"
                className="max-w-full max-h-[70vh] object-contain rounded-xl border border-border shadow-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
