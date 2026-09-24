import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HardDrive,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Eye,
  FileEdit,
  Server,
  Loader2,
  HelpCircle,
  Search,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Database,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  browseNasFolders,
  searchNasFolders,
  getNasCacheStatus,
  triggerNasSync,
  NasCacheStatus,
  NasFolderItem,
  NasFolderRequestItem,
  useNasServers,
} from '../../api/eform-request.api';

// Helper: Ekstrak seluruh hierarki parent path dari sebuah folderPath
// Contoh: "/sja/SJA SPJ/ICT/DEV" -> ["/sja/SJA SPJ/ICT", "/sja/SJA SPJ", "/sja"]
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

interface TreeNodeProps {
  server: (typeof SYNOLOGY_SERVERS_CONFIG)[number];
  folder: NasFolderItem;
  level: number;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  cachedFolders: Record<string, NasFolderItem[]>;
  selections: NasFolderRequestItem[];
  onToggleExpand: (path: string) => void;
  onToggleCheck: (folder: NasFolderItem) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  server,
  folder,
  level,
  expandedPaths,
  loadingPaths,
  cachedFolders,
  selections,
  onToggleExpand,
  onToggleCheck,
}) => {
  const isExpanded = expandedPaths.has(folder.path);
  const isLoading = loadingPaths.has(folder.path);
  const isChecked = selections.some(
    s => s.nasId === server.id && s.folderPath === folder.path
  );
  const subFolders = cachedFolders[folder.path] || [];

  return (
    <div className="select-none text-xs">
      <div
        className={cn(
          'group flex items-center gap-1.5 py-1.5 px-2 rounded-lg transition-colors hover:bg-muted/60',
          isChecked && 'bg-primary/10 font-semibold'
        )}
        style={{ paddingLeft: `${Math.max(0.5, level * 1.1)}rem` }}
      >
        {/* Expand / Collapse Icon */}
        <button
          type="button"
          onClick={() => onToggleExpand(folder.path)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
          title={isExpanded ? 'Tutup folder' : 'Buka folder'}
        >
          {isLoading ? (
            <Loader2 size={13} className="animate-spin text-primary" />
          ) : isExpanded ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} />
          )}
        </button>

        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggleCheck(folder)}
          className={cn(
            'flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer shrink-0',
            isChecked
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-border/80 bg-background hover:border-border'
          )}
          aria-label={`Pilih folder ${folder.name}`}
        >
          {isChecked && <Check size={11} strokeWidth={3} />}
        </button>

        {/* Folder Icon & Name */}
        <div
          onClick={() => onToggleExpand(folder.path)}
          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
        >
          {isExpanded ? (
            <FolderOpen size={15} className="text-amber-500 shrink-0" />
          ) : (
            <Folder size={15} className="text-amber-500/80 shrink-0" />
          )}
          <span className="truncate text-foreground font-medium text-xs">
            {folder.name}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono truncate hidden sm:inline">
            {folder.path}
          </span>
        </div>
      </div>

      {/* Subfolder Children */}
      {isExpanded && (
        <div className="border-l border-border/40 ml-4 pl-1 space-y-0.5 mt-0.5">
          {isLoading ? (
            <div className="flex items-center gap-2 py-1.5 px-3 text-[11px] text-muted-foreground">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span>Memuat subfolder…</span>
            </div>
          ) : subFolders.length > 0 ? (
            subFolders.map(child => (
              <TreeNode
                key={child.path}
                server={server}
                folder={child}
                level={level + 1}
                expandedPaths={expandedPaths}
                loadingPaths={loadingPaths}
                cachedFolders={cachedFolders}
                selections={selections}
                onToggleExpand={onToggleExpand}
                onToggleCheck={onToggleCheck}
              />
            ))
          ) : (
            <div className="py-1 px-3 text-[11px] text-muted-foreground italic">
              Tidak ada subfolder di dalam direktori ini
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SynologyNasSelector: React.FC<SynologyNasSelectorProps> = ({
  selectedServers,
  onSelectedServersChange,
  selections,
  onSelectionsChange,
}) => {
  const { data: serverList } = useNasServers();

  // Tree View state per server
  const [rootFoldersByServer, setRootFoldersByServer] = useState<Record<string, NasFolderItem[]>>({});
  const [cachedFoldersByServer, setCachedFoldersByServer] = useState<Record<string, Record<string, NasFolderItem[]>>>({});
  const [expandedPathsByServer, setExpandedPathsByServer] = useState<Record<string, Set<string>>>({});
  const [loadingPathsByServer, setLoadingPathsByServer] = useState<Record<string, Set<string>>>({});
  const [serverStatus, setServerStatus] = useState<Record<string, { loading: boolean; error?: string }>>({});

  // Manual input state per server
  const [manualInputOpenByServer, setManualInputOpenByServer] = useState<Record<string, boolean>>({});
  const [manualPathInput, setManualPathInput] = useState<Record<string, string>>({});

  // Search & Expand state
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpandedHeight, setIsExpandedHeight] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Server-side deep search state (membaca dari snapshot cache disk & memori)
  const [serverSearchResults, setServerSearchResults] = useState<
    Array<{
      server: (typeof SYNOLOGY_SERVERS_CONFIG)[number];
      folder: NasFolderItem;
    }>
  >([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  // Cache & sync status per server
  const [cacheStatusByServer, setCacheStatusByServer] = useState<Record<string, NasCacheStatus>>({});
  const [syncingServerIds, setSyncingServerIds] = useState<Set<string>>(new Set());

  // Function to refresh cache status
  const refreshCacheStatus = useCallback(async (serverId?: string) => {
    try {
      const statuses = await getNasCacheStatus(serverId);
      if (Array.isArray(statuses)) {
        setCacheStatusByServer(prev => {
          const updated = { ...prev };
          statuses.forEach(s => {
            updated[s.serverId] = s;
          });
          return updated;
        });

        // Update syncing state based on server response
        setSyncingServerIds(prev => {
          const next = new Set(prev);
          statuses.forEach(s => {
            if (s.isSyncing) {
              next.add(s.serverId);
            } else {
              next.delete(s.serverId);
            }
          });
          return next;
        });
      }
    } catch {
      // silently handle status fetch error
    }
  }, []);

  // Poll cache status if any server is syncing
  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  useEffect(() => {
    if (syncingServerIds.size === 0) return;

    const interval = setInterval(() => {
      refreshCacheStatus();
    }, 2500);

    return () => clearInterval(interval);
  }, [syncingServerIds, refreshCacheStatus]);

  // Handler for manual sync trigger
  const handleTriggerSync = async (serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ') => {
    setSyncingServerIds(prev => new Set(prev).add(serverId));
    try {
      await triggerNasSync(serverId, true);
      await refreshCacheStatus(serverId);
    } catch {
      setSyncingServerIds(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  };

  // Instant fast search ke snapshot cache backend
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || selectedServers.length === 0) {
      setServerSearchResults([]);
      setIsSearchingServer(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const foundResults: Array<{
          server: (typeof SYNOLOGY_SERVERS_CONFIG)[number];
          folder: NasFolderItem;
        }> = [];

        await Promise.all(
          selectedServers.map(async serverId => {
            const server = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === serverId);
            if (!server) return;
            try {
              const res = await searchNasFolders(serverId, trimmed);
              if (res.success && Array.isArray(res.folders)) {
                res.folders.forEach(folder => {
                  foundResults.push({ server, folder });
                });
              }
            } catch (err) {
              // Abaikan error individual server saat pencarian
            }
          })
        );

        if (isMounted) {
          setServerSearchResults(foundResults);
        }
      } finally {
        if (isMounted) {
          setIsSearchingServer(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedServers]);

  // Flatten and search: gabungkan hasil server deep crawl dan client cached folders
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const seenKeys = new Set<string>();
    const results: Array<{
      server: (typeof SYNOLOGY_SERVERS_CONFIG)[number];
      folder: NasFolderItem;
    }> = [];

    const addUnique = (
      server: (typeof SYNOLOGY_SERVERS_CONFIG)[number],
      folder: NasFolderItem
    ) => {
      const key = `${server.id}:${folder.path}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({ server, folder });
      }
    };

    // 1. Prioritaskan hasil pencarian server (karena server menjelajah hingga root & subfolder terdalam)
    serverSearchResults.forEach(item => {
      addUnique(item.server, item.folder);
    });

    // 2. Tambahkan folder yang sudah termuat di client (jika nama atau path mengandung query)
    selectedServers.forEach(serverId => {
      const server = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === serverId);
      if (!server) return;

      const checkAndAdd = (folder: NasFolderItem) => {
        if (
          folder.name.toLowerCase().includes(query) ||
          folder.path.toLowerCase().includes(query)
        ) {
          addUnique(server, folder);
        }
      };

      (rootFoldersByServer[serverId] || []).forEach(checkAndAdd);
      const cached = cachedFoldersByServer[serverId] || {};
      Object.values(cached).forEach(subList => {
        subList.forEach(checkAndAdd);
      });
    });

    return results;
  }, [searchQuery, serverSearchResults, selectedServers, rootFoldersByServer, cachedFoldersByServer]);

  // Fetch root shared folders for a server
  const fetchRootFolders = useCallback(async (serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ', force = false) => {
    if (!force && rootFoldersByServer[serverId]) return;

    setServerStatus(prev => ({
      ...prev,
      [serverId]: { loading: true, error: undefined },
    }));

    try {
      const res = await browseNasFolders(serverId, '/');
      if (res.success && Array.isArray(res.folders)) {
        setRootFoldersByServer(prev => ({ ...prev, [serverId]: res.folders }));
        setServerStatus(prev => ({ ...prev, [serverId]: { loading: false } }));
      } else {
        setServerStatus(prev => ({
          ...prev,
          [serverId]: {
            loading: false,
            error: res.message || 'Gagal memuat daftar folder dari server Synology.',
          },
        }));
      }
    } catch (err: any) {
      setServerStatus(prev => ({
        ...prev,
        [serverId]: {
          loading: false,
          error: err.message || 'Koneksi ke Synology timeout atau terputus.',
        },
      }));
    }
  }, [rootFoldersByServer]);

  // Load root folders whenever a server is selected
  useEffect(() => {
    selectedServers.forEach(serverId => {
      if (!rootFoldersByServer[serverId] && !serverStatus[serverId]?.loading) {
        fetchRootFolders(serverId);
      }
    });
  }, [selectedServers, rootFoldersByServer, serverStatus, fetchRootFolders]);

  // Toggle server selection
  const handleToggleServer = (serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ') => {
    if (selectedServers.includes(serverId)) {
      onSelectedServersChange(selectedServers.filter(s => s !== serverId));
      // Also remove any selected folders from this server
      onSelectionsChange(selections.filter(s => s.nasId !== serverId));
    } else {
      onSelectedServersChange([...selectedServers, serverId]);
    }
  };

  // Toggle folder expand/collapse (lazy load subfolders)
  const handleToggleExpand = async (serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ', folderPath: string) => {
    const currentExpanded = expandedPathsByServer[serverId] || new Set<string>();
    const newExpanded = new Set(currentExpanded);

    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
      setExpandedPathsByServer(prev => ({ ...prev, [serverId]: newExpanded }));
      return;
    }

    newExpanded.add(folderPath);
    setExpandedPathsByServer(prev => ({ ...prev, [serverId]: newExpanded }));

    // If subfolders not cached, fetch them
    const currentCache = cachedFoldersByServer[serverId] || {};
    if (!currentCache[folderPath]) {
      const currentLoading = loadingPathsByServer[serverId] || new Set<string>();
      setLoadingPathsByServer(prev => ({
        ...prev,
        [serverId]: new Set(currentLoading).add(folderPath),
      }));

      try {
        const res = await browseNasFolders(serverId, folderPath);
        if (res.success && Array.isArray(res.folders)) {
          setCachedFoldersByServer(prev => ({
            ...prev,
            [serverId]: {
              ...(prev[serverId] || {}),
              [folderPath]: res.folders,
            },
          }));
        }
      } catch (e) {
        // Silently keep empty subfolders on network failure
      } finally {
        setLoadingPathsByServer(prev => {
          const updated = new Set(prev[serverId] || []);
          updated.delete(folderPath);
          return { ...prev, [serverId]: updated };
        });
      }
    }
  };

  // Toggle check/uncheck folder with automatic parent hierarchy handling
  const handleToggleCheck = (
    server: (typeof SYNOLOGY_SERVERS_CONFIG)[number],
    folder: NasFolderItem
  ) => {
    const exists = selections.some(
      s => s.nasId === server.id && s.folderPath === folder.path
    );

    if (exists) {
      // UNCHECK FOLDER
      // 1. Hapus folder yang di-uncheck
      let nextSelections = selections.filter(
        s => !(s.nasId === server.id && s.folderPath === folder.path)
      );

      // 2. Evaluasi auto-parent: jika parent berstatus isAutoParent: true dan tidak memiliki
      // subfolder lain yang masih tercentang di bawahnya, maka parent otomatis ikut ter-uncheck
      const remainingForServer = nextSelections.filter(s => s.nasId === server.id);
      nextSelections = nextSelections.filter(item => {
        if (item.nasId !== server.id) return true;
        if (!item.isAutoParent) return true; // Parent manual tetap dipertahankan

        // Cek apakah masih ada child folder aktif di bawah parent ini
        const hasActiveChild = remainingForServer.some(
          other =>
            other.folderPath !== item.folderPath &&
            other.folderPath.startsWith(
              item.folderPath.endsWith('/') ? item.folderPath : `${item.folderPath}/`
            )
        );
        return hasActiveChild;
      });

      onSelectionsChange(nextSelections);
    } else {
      // CHECK FOLDER
      // 1. Ekstrak seluruh hierarki parent path di atas folder ini
      const parentPaths = getParentPaths(folder.path);
      const nextSelections = [...selections];

      // 2. Otomatis centang seluruh parent path jika belum ada di selections
      // Diberikan hak akses READ_ONLY (sebagai jalur perlintasan / traversal)
      parentPaths.forEach(parentPath => {
        const parentExists = nextSelections.some(
          s => s.nasId === server.id && s.folderPath === parentPath
        );
        if (!parentExists) {
          nextSelections.push({
            nasId: server.id,
            nasName: server.name,
            folderPath: parentPath,
            accessLevel: 'READ_ONLY',
            isAutoParent: true,
          });
        }
      });

      // 3. Tambahkan folder yang dipilih oleh user
      // Jika sebelumnya folder ini berstatus isAutoParent, upgrade menjadi manual (isAutoParent: false)
      const existingFolderIdx = nextSelections.findIndex(
        s => s.nasId === server.id && s.folderPath === folder.path
      );
      if (existingFolderIdx >= 0) {
        nextSelections[existingFolderIdx] = {
          ...nextSelections[existingFolderIdx],
          isAutoParent: false,
        };
      } else {
        nextSelections.push({
          nasId: server.id,
          nasName: server.name,
          folderPath: folder.path,
          accessLevel: 'READ_ONLY',
          isAutoParent: false,
        });
      }

      onSelectionsChange(nextSelections);
    }
  };

  // Update access level for a selected folder
  const handleUpdateAccessLevel = (index: number, level: 'READ_ONLY' | 'READ_WRITE') => {
    const updated = [...selections];
    // Jika user mengedit hak akses, jadikan sebagai konfigurasi eksplisit (bukan perlintasan pasif)
    updated[index] = { ...updated[index], accessLevel: level, isAutoParent: false };
    onSelectionsChange(updated);
  };

  // Remove a selected folder
  const handleRemoveSelection = (index: number) => {
    const itemToRemove = selections[index];
    let nextSelections = selections.filter((_, i) => i !== index);

    if (itemToRemove) {
      const remainingForServer = nextSelections.filter(s => s.nasId === itemToRemove.nasId);
      nextSelections = nextSelections.filter(item => {
        if (item.nasId !== itemToRemove.nasId) return true;
        if (!item.isAutoParent) return true;

        const hasActiveChild = remainingForServer.some(
          other =>
            other.folderPath !== item.folderPath &&
            other.folderPath.startsWith(
              item.folderPath.endsWith('/') ? item.folderPath : `${item.folderPath}/`
            )
        );
        return hasActiveChild;
      });
    }

    onSelectionsChange(nextSelections);
  };

  // Bulk set all selections to specific access level
  const handleBulkAccessLevel = (level: 'READ_ONLY' | 'READ_WRITE') => {
    onSelectionsChange(selections.map(s => ({ ...s, accessLevel: level })));
  };

  // Add manual folder path fallback
  const handleAddManualFolder = (server: (typeof SYNOLOGY_SERVERS_CONFIG)[number]) => {
    const rawPath = manualPathInput[server.id]?.trim();
    if (!rawPath) return;

    const formattedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const exists = selections.some(
      s => s.nasId === server.id && s.folderPath.toLowerCase() === formattedPath.toLowerCase()
    );

    if (!exists) {
      onSelectionsChange([
        ...selections,
        {
          nasId: server.id,
          nasName: server.name,
          folderPath: formattedPath,
          accessLevel: 'READ_ONLY',
          isManualInput: true,
        },
      ]);
    }

    setManualPathInput(prev => ({ ...prev, [server.id]: '' }));
    setManualInputOpenByServer(prev => ({ ...prev, [server.id]: false }));
  };

  // Render Search Results view
  const renderSearchResults = (isModal = false) => {
    return (
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Search size={14} className="text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground">
              Hasil Pencarian untuk &ldquo;{searchQuery}&rdquo;
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
              {searchResults.length} folder ditemukan
            </span>
            {isSearchingServer && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span>Menyaring dari cache lokal NAS...</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer ml-auto"
            title="Bersihkan pencarian"
          >
            <X size={12} /> Bersihkan
          </button>
        </div>

        {isSearchingServer && searchResults.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Loader2 size={24} className="mx-auto text-primary animate-spin" />
            <p className="text-xs font-semibold text-foreground">
              Mencari folder &ldquo;{searchQuery}&rdquo; di cache lokal...
            </p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <FolderOpen size={30} className="mx-auto text-muted-foreground/40" />
            <p className="text-xs font-medium text-foreground">
              Tidak ditemukan folder yang cocok dengan &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              Folder tidak ditemukan di dalam cache Synology NAS. Anda dapat menekan tombol <strong>Sync Cache</strong> untuk menyinkronkan snapshot dari server, atau gunakan tombol <strong>Input Path Manual</strong>.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-2 space-y-1',
              isModal ? 'max-h-[55vh]' : (isExpandedHeight ? 'max-h-[520px]' : 'max-h-80')
            )}
          >
            {searchResults.map(({ server, folder }) => {
              const isChecked = selections.some(
                s => s.nasId === server.id && s.folderPath === folder.path
              );

              return (
                <div
                  key={`${server.id}-${folder.path}`}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg border transition-colors',
                    isChecked
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-card border-border/60 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleCheck(server, folder)}
                      className={cn(
                        'flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer shrink-0',
                        isChecked
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border/80 bg-background hover:border-border'
                      )}
                      aria-label={`Pilih folder ${folder.name}`}
                    >
                      {isChecked && <Check size={11} strokeWidth={3} />}
                    </button>
                    <span className={cn('px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0', server.badgeColor)}>
                      {server.id}
                    </span>
                    <Folder size={15} className="text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-foreground block truncate">
                        {folder.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground block truncate">
                        {folder.path}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isChecked ? 'default' : 'outline'}
                    onClick={() => handleToggleCheck(server, folder)}
                    className="h-7 text-xs px-2.5 rounded-lg shrink-0 ml-2"
                  >
                    {isChecked ? 'Terpilih' : 'Pilih Folder'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render Tree Explorers view
  const renderTreeExplorers = (isModal = false) => {
    return (
      <div className="grid grid-cols-1 gap-4">
        {selectedServers.map(serverId => {
          const server = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === serverId)!;
          const status = serverStatus[serverId] || { loading: false };
          const roots = rootFoldersByServer[serverId] || [];
          const isManualOpen = manualInputOpenByServer[serverId] || false;
          const selectedCount = selections.filter(s => s.nasId === server.id).length;
          const cacheStatus = cacheStatusByServer[server.id];
          const isSyncing = syncingServerIds.has(server.id) || cacheStatus?.isSyncing;

          return (
            <div
              key={server.id}
              className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3"
            >
              {/* Header Explorer Cabang */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-bold border', server.badgeColor)}>
                    {server.id}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {server.name} — {server.location}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                    ({server.host}:{server.port})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCount > 0 && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      {selectedCount} folder dipilih
                    </span>
                  )}

                  {/* Cache info badge */}
                  {cacheStatus && (
                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background/80 border border-border/60 px-2 py-0.5 rounded-md font-mono">
                      <Database size={11} className="text-primary shrink-0" />
                      <span>{cacheStatus.totalFolders} folder</span>
                      {cacheStatus.lastSyncedAt && (
                        <span className="text-muted-foreground/60 hidden md:inline">
                          • {new Date(cacheStatus.lastSyncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sync Cache Button */}
                  <button
                    type="button"
                    onClick={() => handleTriggerSync(server.id)}
                    disabled={isSyncing}
                    className={cn(
                      'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors cursor-pointer',
                      isSyncing
                        ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                        : 'border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                    title="Perbarui & sinkronkan seluruh peta folder dari Synology ke cache lokal backend"
                  >
                    <RefreshCw size={12} className={cn((status.loading || isSyncing) && 'animate-spin text-primary')} />
                    <span>{isSyncing ? 'Menyinkronkan…' : 'Sync Cache'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setManualInputOpenByServer(prev => ({
                        ...prev,
                        [server.id]: !isManualOpen,
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:bg-primary/10 px-2 py-1 rounded-md border border-primary/20 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Input Path Manual</span>
                  </button>
                </div>
              </div>

              {/* Manual Path Fallback Form */}
              {isManualOpen && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Ketik Path Folder Manual untuk {server.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Gunakan jika folder belum terdaftar di tree atau server offline
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={manualPathInput[server.id] || ''}
                      onChange={e =>
                        setManualPathInput(prev => ({
                          ...prev,
                          [server.id]: e.target.value,
                        }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddManualFolder(server);
                        }
                      }}
                      placeholder="Contoh: /Sharing/Dept_Keuangan atau Data_Arsip_2026"
                      className="h-9 rounded-lg bg-background font-mono text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddManualFolder(server)}
                      className="h-9 px-3 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Tambah Folder
                    </Button>
                  </div>
                </div>
              )}

              {/* Body: Loading, Error, or Tree */}
              {status.loading && roots.length === 0 ? (
                <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-muted-foreground">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span>Menghubungi Synology {server.name} ({server.host})...</span>
                </div>
              ) : status.error ? (
                <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Tidak dapat memuat folder secara otomatis:</p>
                      <p className="text-[11px] mt-0.5">{status.error}</p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchRootFolders(server.id, true)}
                      className="h-7 text-xs rounded-md"
                    >
                      Coba Lagi
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() =>
                        setManualInputOpenByServer(prev => ({
                          ...prev,
                          [server.id]: true,
                        }))
                      }
                      className="h-7 text-xs rounded-md"
                    >
                      Gunakan Input Manual
                    </Button>
                  </div>
                </div>
              ) : roots.length === 0 ? (
                <div className="text-center py-5 text-xs text-muted-foreground italic">
                  Tidak ada shared folder yang ditemukan pada Synology {server.name}.
                </div>
              ) : (
                <div
                  className={cn(
                    'overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-2 space-y-0.5 transition-all duration-200',
                    isModal ? 'max-h-[50vh]' : (isExpandedHeight ? 'max-h-[520px]' : 'max-h-64')
                  )}
                >
                  {roots.map(folder => (
                    <TreeNode
                      key={folder.path}
                      server={server}
                      folder={folder}
                      level={0}
                      expandedPaths={expandedPathsByServer[server.id] || new Set()}
                      loadingPaths={loadingPathsByServer[server.id] || new Set()}
                      cachedFolders={cachedFoldersByServer[server.id] || {}}
                      selections={selections}
                      onToggleExpand={path => handleToggleExpand(server.id, path)}
                      onToggleCheck={f => handleToggleCheck(server, f)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render Selections Table view
  const renderSelectionsTable = (isModal = false) => {
    if (selections.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center space-y-1.5">
          <HardDrive size={24} className="mx-auto text-muted-foreground/60" />
          <p className="text-xs font-semibold text-foreground">
            Belum ada folder yang dipilih
          </p>
          <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
            Silakan pilih minimal satu server Synology di atas, lalu centang folder yang diinginkan atau gunakan tombol <strong>Input Path Manual</strong>.
          </p>
        </div>
      );
    }

    return (
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
                  <tr key={`${item.nasId}-${item.folderPath}`} className="hover:bg-muted/30 transition-colors">
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
                        {item.isAutoParent && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 shrink-0 font-sans font-medium"
                            title="Folder induk otomatis dicentang sebagai jalur akses perlintasan"
                          >
                            Parent (Auto)
                          </span>
                        )}
                        {item.isManualInput && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground border shrink-0 font-sans">
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

        <div className="bg-muted/30 px-3.5 py-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Total: <strong>{selections.length} folder</strong> terpilih</span>
          <span>Hak akses akan diaudit dan dikonfigurasikan sesuai otorisasi atasan</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Pemilihan Server Synology NAS (Bisa lebih dari 1) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pilih Server Synology NAS <span className="text-destructive">*</span>
          </label>
          <span className="text-[11px] text-muted-foreground font-medium">
            Bisa memilih lebih dari 1 cabang
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SYNOLOGY_SERVERS_CONFIG.map(server => {
            const isSelected = selectedServers.includes(server.id);
            const countForServer = selections.filter(s => s.nasId === server.id).length;

            return (
              <button
                key={server.id}
                type="button"
                onClick={() => handleToggleServer(server.id)}
                className={cn(
                  'flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[74px] relative select-none',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40'
                    : 'border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold font-mono tracking-tight flex items-center gap-1.5">
                    <Server size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                    <span>{server.name}</span>
                  </span>
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors',
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border/80 bg-background'
                    )}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  {server.location}
                </p>

                <div className="flex items-center justify-between w-full mt-1.5 pt-1 border-t border-border/40 text-[10px] font-mono">
                  <span className="text-muted-foreground/80">{server.host}</span>
                  {countForServer > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full font-bold text-primary bg-primary/20">
                      {countForServer} folder
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Live Folder Tree Explorer per Selected Server */}
      {selectedServers.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Jelajah &amp; Centang Folder Shared NAS
              </label>
              <span className="text-[11px] text-muted-foreground">
                {searchQuery.trim()
                  ? `Menampilkan hasil pencarian untuk "${searchQuery}"`
                  : 'Klik tanda panah untuk membuka subfolder'}
              </span>
            </div>

            {/* Toolbar: Search, Height Expander, Fullscreen Modal */}
            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="relative w-full sm:w-56 md:w-64">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari folder / path..."
                  className="h-8 pl-8 pr-7 text-xs rounded-lg bg-background"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* In-place Height Toggle Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExpandedHeight(prev => !prev)}
                className="h-8 px-2 text-xs font-semibold rounded-lg text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                title={isExpandedHeight ? 'Perkecil area kotak' : 'Perluas area kotak'}
              >
                {isExpandedHeight ? (
                  <>
                    <Minimize2 size={13} className="sm:mr-1" />
                    <span className="hidden sm:inline">Perkecil</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={13} className="sm:mr-1" />
                    <span className="hidden sm:inline">Perluas</span>
                  </>
                )}
              </Button>

              {/* Maximize Fullscreen Modal Button */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="h-8 px-2.5 text-xs font-bold rounded-lg shadow-2xs cursor-pointer shrink-0 border border-border/80"
                title="Buka penjelajah folder layar penuh"
              >
                <ExternalLink size={13} className="mr-1" />
                <span className="hidden sm:inline">Layar Penuh</span>
                <span className="sm:hidden">Full</span>
              </Button>
            </div>
          </div>

          {searchQuery.trim() ? renderSearchResults(false) : renderTreeExplorers(false)}
        </div>
      )}

      {/* 3. Tabel Rangkuman Folder Terpilih & Pengaturan Hak Akses */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Daftar Folder &amp; Hak Akses yang Diajukan <span className="text-destructive">*</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Atur hak akses secara spesifik untuk masing-masing folder yang dipilih
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

        {renderSelectionsTable(false)}
      </div>

      {/* 4. Modal Dialog Layar Penuh (Fullscreen Workspace Explorer) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          size="full"
          className="max-w-[94vw] w-full h-[90vh] flex flex-col p-5 sm:p-6 rounded-2xl overflow-hidden bg-card"
        >
          <DialogHeader className="border-b border-border/60 pb-3 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Server className="text-primary h-5 w-5" />
                  <span>Penjelajah Folder Synology NAS (Layar Penuh)</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Jelajahi dan pilih folder shared NAS lintas cabang dengan ruang kerja yang luas
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari folder atau path..."
                    className="h-8 pl-8 pr-7 text-xs rounded-lg bg-background"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Body: 2 Columns */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden py-1">
            {/* Left Column: Explorer Tree / Search (7 cols) */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden space-y-2.5">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pohon Direktori Shared Folder
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {selectedServers.length} cabang aktif ({selectedServers.join(', ')})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-3">
                {searchQuery.trim() ? renderSearchResults(true) : renderTreeExplorers(true)}
              </div>
            </div>

            {/* Right Column: Selected Folders Table & Access Level (5 cols) */}
            <div className="lg:col-span-5 flex flex-col h-full min-h-0 overflow-hidden border-t lg:border-t-0 lg:border-l lg:pl-5 pt-3 lg:pt-0 space-y-2.5">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Folder Terpilih ({selections.length})
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Atur hak akses untuk masing-masing folder
                  </p>
                </div>
                {selections.length > 1 && (
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleBulkAccessLevel('READ_ONLY')}
                      className="px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-[10px] font-semibold cursor-pointer"
                    >
                      All Read Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAccessLevel('READ_WRITE')}
                      className="px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-[10px] font-semibold cursor-pointer"
                    >
                      All Read/Write
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-border/80 bg-background p-1.5">
                {renderSelectionsTable(true)}
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="border-t border-border/60 pt-3 flex items-center justify-between shrink-0">
            <div className="text-xs text-muted-foreground">
              {selections.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ {selections.length} folder telah dipilih
                </span>
              ) : (
                <span>Belum ada folder yang dipilih</span>
              )}
            </div>
            <Button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl px-5 font-bold h-9 text-xs cursor-pointer"
            >
              Selesai Memilih &amp; Kembali
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
