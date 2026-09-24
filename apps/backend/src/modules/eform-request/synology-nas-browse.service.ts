import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { SynologyService } from '../synology/synology.service';
import { BrowseNasFolderDto } from './dto/browse-nas-folder.dto';
import { SearchNasFolderDto } from './dto/search-nas-folder.dto';
import {
  NasFolderCacheItem,
  NasServerCacheSnapshot,
  NasCacheStatusDto,
} from './interfaces/nas-cache.interface';

export interface NasServerMetadata {
  id: 'JKT' | 'KRW' | 'SMG' | 'SPJ';
  name: string;
  location: string;
  host: string;
  port: number;
}

export const SYNOLOGY_SERVERS_CONFIG: NasServerMetadata[] = [
  { id: 'JKT', name: 'Synology Jakarta (JKT)', location: 'Jakarta', host: '10.11.2.6', port: 30001 },
  { id: 'KRW', name: 'Synology Karawang (KRW)', location: 'Karawang', host: '10.12.2.6', port: 30001 },
  { id: 'SMG', name: 'Synology Semarang (SMG)', location: 'Semarang', host: '10.14.2.16', port: 30001 },
  { id: 'SPJ', name: 'Synology Sepanjang (SPJ)', location: 'Sepanjang', host: '192.168.2.16', port: 30001 },
];

const NAS_VIEWER_USER = process.env.SYNOLOGY_VIEWER_USER || 'ict';
const NAS_VIEWER_PASS = process.env.SYNOLOGY_VIEWER_PASS || 'P@ssw0rd_G00d@D4y';

@Injectable()
export class SynologyNasBrowseService implements OnModuleInit {
  private readonly logger = new Logger(SynologyNasBrowseService.name);
  private readonly cacheDir = path.join(process.cwd(), 'storage', 'nas-cache');
  private readonly snapshotCache = new Map<string, NasServerCacheSnapshot>();

  constructor(private readonly synologyService: SynologyService) {}

  async onModuleInit() {
    this.ensureCacheDirectory();
    this.loadAllSnapshotsFromDisk();

    // Jalankan background sync awal untuk server SPJ jika cache belum ada
    setTimeout(() => {
      const spjSnapshot = this.snapshotCache.get('SPJ');
      if (!spjSnapshot || spjSnapshot.folders.length === 0) {
        this.logger.log('Initial startup: SPJ snapshot empty. Triggering background indexer...');
        this.syncServerCache('SPJ').catch(err => {
          this.logger.warn(`Initial sync for SPJ error: ${err.message}`);
        });
      }
    }, 5000);
  }

  private ensureCacheDirectory() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        this.logger.log(`Created NAS cache directory: ${this.cacheDir}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to ensure NAS cache directory: ${err.message}`, err.stack);
    }
  }

  private getSnapshotFilePath(serverId: string): string {
    return path.join(this.cacheDir, `${serverId}.json`);
  }

  private loadAllSnapshotsFromDisk() {
    SYNOLOGY_SERVERS_CONFIG.forEach(server => {
      const filePath = this.getSnapshotFilePath(server.id);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data: NasServerCacheSnapshot = JSON.parse(raw);
          if (Array.isArray(data.folders)) {
            // Reset isSyncing ke false jika backend sempat restart saat proses berlangsung
            data.isSyncing = false;
            this.snapshotCache.set(server.id, data);
            this.logger.log(
              `Loaded NAS snapshot for ${server.id}: ${data.folders.length} folders (last synced: ${data.lastSyncedAt || 'never'})`
            );
          }
        } catch (err: any) {
          this.logger.warn(`Failed reading NAS snapshot file for ${server.id}: ${err.message}`);
        }
      }
    });
  }

  private saveSnapshotToDisk(serverId: string, snapshot: NasServerCacheSnapshot) {
    try {
      this.ensureCacheDirectory();
      const filePath = this.getSnapshotFilePath(serverId);
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
      this.logger.log(`Saved NAS snapshot to disk: ${filePath} (${snapshot.totalFolders} folders)`);
    } catch (err: any) {
      this.logger.error(`Failed saving NAS snapshot for ${serverId}: ${err.message}`, err.stack);
    }
  }

  getNasServers() {
    return SYNOLOGY_SERVERS_CONFIG.map(({ id, name, location, host, port }) => ({
      id,
      name,
      location,
      host,
      port,
    }));
  }

  getCacheStatus(serverId?: string): NasCacheStatusDto[] {
    const servers = serverId
      ? SYNOLOGY_SERVERS_CONFIG.filter(s => s.id === serverId)
      : SYNOLOGY_SERVERS_CONFIG;

    return servers.map(server => {
      const snapshot = this.snapshotCache.get(server.id);
      return {
        serverId: server.id,
        serverName: server.name,
        lastSyncedAt: snapshot?.lastSyncedAt || null,
        isSyncing: snapshot?.isSyncing || false,
        totalFolders: snapshot?.totalFolders || snapshot?.folders?.length || 0,
      };
    });
  }

  /**
   * Memicu sinkronisasi folder NAS secara asinkron di latar belakang
   */
  async syncServerCache(
    serverId: 'JKT' | 'KRW' | 'SMG' | 'SPJ',
    force = false
  ): Promise<{
    success: boolean;
    serverId: string;
    isSyncing: boolean;
    message: string;
  }> {
    const server = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === serverId);
    if (!server) {
      throw new BadRequestException(`Server Synology '${serverId}' tidak terdaftar.`);
    }

    const currentSnapshot = this.snapshotCache.get(serverId);
    if (currentSnapshot?.isSyncing && !force) {
      return {
        success: true,
        serverId,
        isSyncing: true,
        message: `Sinkronisasi folder untuk ${server.name} sedang berlangsung di latar belakang.`,
      };
    }

    // Tandai status isSyncing
    const updatedSnapshot: NasServerCacheSnapshot = {
      serverId,
      serverName: server.name,
      lastSyncedAt: currentSnapshot?.lastSyncedAt || null,
      isSyncing: true,
      totalFolders: currentSnapshot?.totalFolders || 0,
      folders: currentSnapshot?.folders || [],
    };
    this.snapshotCache.set(serverId, updatedSnapshot);

    // Jalankan background crawl non-blocking
    this.executeBackgroundCrawl(server).catch(err => {
      this.logger.error(`Background crawl error on ${server.id}: ${err.message}`, err.stack);
      const snap = this.snapshotCache.get(serverId);
      if (snap) {
        snap.isSyncing = false;
      }
    });

    return {
      success: true,
      serverId,
      isSyncing: true,
      message: `Sinkronisasi folder untuk ${server.name} telah dimulai di latar belakang.`,
    };
  }

  /**
   * Worker rekursif asinkron untuk mengumpulkan peta hierarki folder (kedalaman maks 5)
   */
  private async executeBackgroundCrawl(server: NasServerMetadata) {
    this.logger.log(`Starting background NAS crawler for ${server.id} (${server.host}:${server.port})...`);
    const maxDepth = 5;
    const allFolders: NasFolderCacheItem[] = [];
    const seenPaths = new Set<string>();

    // Antrian penjelajahan: FIFO
    const queue: Array<{ path: string; depth: number }> = [{ path: '/', depth: 1 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepth || allFolders.length >= 3000) continue;

      try {
        const res = await this.synologyService.listFolders({
          synologyHost: server.host,
          synologyPort: server.port,
          synologyUsername: NAS_VIEWER_USER,
          synologyPassword: NAS_VIEWER_PASS,
          path: current.path === '/' ? undefined : current.path,
        });

        if (!res.success || !Array.isArray(res.folders)) continue;

        for (const f of res.folders) {
          if (!f.isDir) continue;

          const nameLower = (f.name || '').toLowerCase();
          if (
            nameLower.startsWith('#recycle') ||
            nameLower.startsWith('@eadir') ||
            nameLower.startsWith('odb$')
          ) {
            continue;
          }

          if (seenPaths.has(f.path)) continue;
          seenPaths.add(f.path);

          allFolders.push({
            name: f.name,
            path: f.path,
            parentPath: current.path,
            depth: current.depth,
            isDir: true,
          });

          // Masukkan ke antrian untuk subfolder jika belum melebihi kedalaman maksimal
          if (current.depth < maxDepth) {
            queue.push({ path: f.path, depth: current.depth + 1 });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed reading folder path "${current.path}" on ${server.id}: ${err.message}`);
      }
    }

    // Selesai crawling, simpan snapshot
    const completedSnapshot: NasServerCacheSnapshot = {
      serverId: server.id,
      serverName: server.name,
      lastSyncedAt: new Date().toISOString(),
      isSyncing: false,
      totalFolders: allFolders.length,
      folders: allFolders,
    };

    this.snapshotCache.set(server.id, completedSnapshot);
    this.saveSnapshotToDisk(server.id, completedSnapshot);

    this.logger.log(
      `Background crawl completed for ${server.id}: ${allFolders.length} folders indexed and cached.`
    );
  }

  /**
   * Cron Job harian: update cache folder Synology setiap pukul 01:00 AM
   */
  @Cron('0 1 * * *')
  async handleDailyCacheSync() {
    this.logger.log('Running daily scheduled Synology NAS folder cache sync...');
    for (const server of SYNOLOGY_SERVERS_CONFIG) {
      try {
        await this.syncServerCache(server.id, true);
      } catch (err: any) {
        this.logger.warn(`Scheduled sync failed for ${server.id}: ${err.message}`);
      }
    }
  }

  /**
   * Menjelajahi folder secara instan dari cache snapshot (fallback ke live Synology bila cache kosong)
   */
  async browseNasFolders(dto: BrowseNasFolderDto): Promise<{
    success: boolean;
    serverId: string;
    path: string;
    folders: Array<{ name: string; path: string; isDir: boolean }>;
    fromCache?: boolean;
    message?: string;
  }> {
    const server = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === dto.serverId);
    if (!server) {
      throw new BadRequestException(`Server Synology '${dto.serverId}' tidak terdaftar.`);
    }

    const targetPath = dto.path && dto.path.trim() !== '' ? dto.path.trim() : '/';
    const snapshot = this.snapshotCache.get(server.id);

    // Jika snapshot cache sudah ada dan memiliki folder, kembalikan instan (< 1 ms)!
    if (snapshot && snapshot.folders.length > 0) {
      const normalizedTarget = targetPath.replace(/\/+$/, '') || '/';
      const matchedFolders = snapshot.folders
        .filter(item => {
          const itemParent = item.parentPath.replace(/\/+$/, '') || '/';
          return itemParent === normalizedTarget;
        })
        .map(({ name, path: fPath, isDir }) => ({ name, path: fPath, isDir }));

      return {
        success: true,
        serverId: server.id,
        path: targetPath,
        folders: matchedFolders,
        fromCache: true,
      };
    }

    // Fallback: Panggil live Synology dan picu background sync otomatis
    try {
      this.logger.log(`Live fallback listing for server ${server.id} path: ${targetPath}`);

      const result = await this.synologyService.listFolders({
        synologyHost: server.host,
        synologyPort: server.port,
        synologyUsername: NAS_VIEWER_USER,
        synologyPassword: NAS_VIEWER_PASS,
        path: targetPath === '/' ? undefined : targetPath,
      });

      if (!result.success) {
        return {
          success: false,
          serverId: server.id,
          path: targetPath,
          folders: [],
          message: result.message || `Tidak dapat mengakses folder pada server ${server.name}`,
        };
      }

      const folderOnly = (result.folders || []).filter(f => {
        if (!f.isDir) return false;
        const nameLower = (f.name || '').toLowerCase();
        return (
          !nameLower.startsWith('#recycle') &&
          !nameLower.startsWith('@eadir') &&
          !nameLower.startsWith('odb$')
        );
      });

      // Picu background sync jika cache kosong
      if (!snapshot?.isSyncing) {
        this.syncServerCache(server.id).catch(() => {});
      }

      return {
        success: true,
        serverId: server.id,
        path: targetPath,
        folders: folderOnly,
        fromCache: false,
      };
    } catch (err: any) {
      this.logger.error(`Error browsing Synology ${server.id}: ${err.message}`, err.stack);
      return {
        success: false,
        serverId: server.id,
        path: targetPath,
        folders: [],
        message: err.message || `Koneksi ke ${server.name} timeout atau gagal tersambung`,
      };
    }
  }

  /**
   * Pencarian folder global instan dari cache snapshot (< 5 ms)
   */
  async searchNasFolders(dto: SearchNasFolderDto): Promise<{
    success: boolean;
    serverId: string;
    query: string;
    count: number;
    folders: Array<{ name: string; path: string; isDir: boolean }>;
    fromCache?: boolean;
    lastSyncedAt?: string | null;
    isSyncing?: boolean;
    message?: string;
  }> {
    const server = SYNOLOGY_SERVERS_CONFIG.find(s => s.id === dto.serverId);
    if (!server) {
      throw new BadRequestException(`Server Synology '${dto.serverId}' tidak terdaftar.`);
    }

    const q = (dto.query || '').trim().toLowerCase();
    if (!q) {
      return {
        success: true,
        serverId: server.id,
        query: '',
        count: 0,
        folders: [],
      };
    }

    const snapshot = this.snapshotCache.get(server.id);

    // 1. Jika snapshot cache tersedia: cari langsung di memori lokal secara instan!
    if (snapshot && snapshot.folders.length > 0) {
      const matched = snapshot.folders.filter(f => {
        return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
      });

      return {
        success: true,
        serverId: server.id,
        query: dto.query,
        count: matched.length,
        folders: matched.slice(0, 150).map(({ name, path: fPath, isDir }) => ({
          name,
          path: fPath,
          isDir,
        })),
        fromCache: true,
        lastSyncedAt: snapshot.lastSyncedAt,
        isSyncing: snapshot.isSyncing,
      };
    }

    // 2. Jika snapshot belum ada: picu sinkronisasi di background dan kembalikan fallback cepat
    this.logger.log(`Snapshot for ${server.id} empty on search. Triggering sync in background...`);
    this.syncServerCache(server.id).catch(() => {});

    // Lakukan pencarian shallow live sederhana agar tidak hang
    try {
      const browseRes = await this.browseNasFolders({ serverId: server.id, path: '/' });
      const matched = (browseRes.folders || []).filter(
        f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
      );

      return {
        success: true,
        serverId: server.id,
        query: dto.query,
        count: matched.length,
        folders: matched,
        fromCache: false,
        isSyncing: true,
        message: 'Cache sedang dibangun di latar belakang. Hasil akan lengkap setelah sinkronisasi selesai.',
      };
    } catch (err: any) {
      return {
        success: false,
        serverId: server.id,
        query: dto.query,
        count: 0,
        folders: [],
        message: err.message,
      };
    }
  }
}
