export interface NasFolderCacheItem {
  name: string;
  path: string;
  parentPath: string;
  depth: number;
  isDir: boolean;
}

export interface NasServerCacheSnapshot {
  serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ';
  serverName: string;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  totalFolders: number;
  folders: NasFolderCacheItem[];
}

export interface NasCacheStatusDto {
  serverId: string;
  serverName: string;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  totalFolders: number;
}
