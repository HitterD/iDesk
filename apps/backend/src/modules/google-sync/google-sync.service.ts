import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpreadsheetConfig, SpreadsheetSheet, SyncLog, SyncLogDirection, SyncStatus } from './entities';
import { GoogleSheetsAdapter } from './adapters';
import { CreateSpreadsheetConfigDto, UpdateSpreadsheetConfigDto, CreateSheetMappingDto, UpdateSheetMappingDto } from './dto';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class GoogleSyncService {
    private readonly logger = new Logger(GoogleSyncService.name);

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(SpreadsheetConfig)
        private readonly configRepo: Repository<SpreadsheetConfig>,
        @InjectRepository(SpreadsheetSheet)
        private readonly sheetRepo: Repository<SpreadsheetSheet>,
        @InjectRepository(SyncLog)
        private readonly logRepo: Repository<SyncLog>,
        private readonly sheetsAdapter: GoogleSheetsAdapter,
        private readonly eventsGateway: EventsGateway,
    ) { }

    // === STATUS ===

    /**
     * Check if Google Sheets integration is available
     */
    isAvailable(): boolean {
        return this.sheetsAdapter.isReady();
    }

    /**
     * Get integration status - also attempts to initialize if not ready
     */
    async getStatus() {
        // Trigger initialization on status check (lazy init)
        if (!this.sheetsAdapter.isReady()) {
            await this.sheetsAdapter.initialize();
        }

        const configs = await this.configRepo.count({ where: { isActive: true } });
        const sheets = await this.sheetRepo.count({ where: { syncEnabled: true } });

        return {
            isAvailable: this.isAvailable(),
            activeSpreadsheets: configs,
            activeSyncSheets: sheets,
        };
    }

    // === SPREADSHEET CONFIG CRUD ===

    async findAllConfigs(): Promise<SpreadsheetConfig[]> {
        return this.configRepo.find({
            relations: ['sheets'],
            order: { createdAt: 'DESC' },
        });
    }

    async findConfigById(id: string): Promise<SpreadsheetConfig> {
        const config = await this.configRepo.findOne({
            where: { id },
            relations: ['sheets'],
        });
        if (!config) throw new NotFoundException('Spreadsheet config not found');
        return config;
    }

    async createConfig(dto: CreateSpreadsheetConfigDto): Promise<SpreadsheetConfig> {
        // Validate the spreadsheet exists and is accessible
        if (this.isAvailable()) {
            try {
                const metadata = await this.sheetsAdapter.getSpreadsheetMetadata(dto.spreadsheetId);
                this.logger.log(`Validated spreadsheet: ${metadata.title}`);
            } catch (error) {
                throw new BadRequestException(`Cannot access spreadsheet: ${error.message}`);
            }
        }

        const config = this.configRepo.create({
            ...dto,
            defaultSyncIntervalSeconds: dto.defaultSyncIntervalSeconds || 30,
        });

        return this.configRepo.save(config);
    }

    async updateConfig(id: string, dto: UpdateSpreadsheetConfigDto, userId?: string): Promise<SpreadsheetConfig> {
        const config = await this.findConfigById(id);
        const oldValue = { ...config };
        Object.assign(config, dto);
        const saved = await this.configRepo.save(config);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SYNC_CONFIG_UPDATE,
                entityType: 'SpreadsheetConfig',
                entityId: saved.id,
                description: `Updated Google Sync Config: ${saved.name}`,
                oldValue: { isActive: oldValue.isActive },
                newValue: { isActive: saved.isActive },
            });
        }

        return saved;
    }

    async logSyncTrigger(sheetId: string, userId: string) {
        this.auditService.logAsync({
            userId,
            action: AuditAction.GOOGLE_SYNC_TRIGGER,
            entityType: 'SpreadsheetSheet',
            entityId: sheetId,
            description: `Triggered manual sync for sheet ${sheetId}`,
        });
    }

    async deleteConfig(id: string): Promise<void> {
        const config = await this.findConfigById(id);
        await this.configRepo.remove(config);
    }

    // === SHEET MAPPING CRUD ===

    async findAllSheets(configId?: string): Promise<SpreadsheetSheet[]> {
        const where = configId ? { configId } : {};
        return this.sheetRepo.find({
            where,
            relations: ['config'],
            order: { createdAt: 'DESC' },
        });
    }

    async findSheetById(id: string): Promise<SpreadsheetSheet> {
        const sheet = await this.sheetRepo.findOne({
            where: { id },
            relations: ['config'],
        });
        if (!sheet) throw new NotFoundException('Sheet mapping not found');
        return sheet;
    }

    async createSheetMapping(dto: CreateSheetMappingDto): Promise<SpreadsheetSheet> {
        // Validate config exists
        await this.findConfigById(dto.configId);

        const sheet = this.sheetRepo.create({
            ...dto,
            headerRow: dto.headerRow || 1,
            dataStartRow: dto.dataStartRow || 2,
            syncIntervalSeconds: dto.syncIntervalSeconds || 30,
        });

        return this.sheetRepo.save(sheet);
    }

    async updateSheetMapping(id: string, dto: UpdateSheetMappingDto): Promise<SpreadsheetSheet> {
        const sheet = await this.findSheetById(id);
        Object.assign(sheet, dto);
        return this.sheetRepo.save(sheet);
    }

    async deleteSheetMapping(id: string): Promise<void> {
        const sheet = await this.findSheetById(id);
        await this.sheetRepo.remove(sheet);
    }

    // === SYNC LOGS ===

    async getSyncLogs(sheetId?: string, limit = 50): Promise<SyncLog[]> {
        const query = this.logRepo.createQueryBuilder('log')
            .leftJoinAndSelect('log.sheet', 'sheet')
            .leftJoinAndSelect('log.triggeredBy', 'user')
            .orderBy('log.syncedAt', 'DESC')
            .take(limit);

        if (sheetId) {
            query.where('log.sheetId = :sheetId', { sheetId });
        }

        return query.getMany();
    }

    async createSyncLog(data: Partial<SyncLog>): Promise<SyncLog> {
        const log = this.logRepo.create(data);
        return this.logRepo.save(log);
    }

    // === AVAILABLE SHEETS ===

    async getAvailableSheets(spreadsheetId: string) {
        if (!this.isAvailable()) {
            throw new BadRequestException('Google Sheets integration not available');
        }

        return this.sheetsAdapter.getSpreadsheetMetadata(spreadsheetId);
    }

    async getSheetHeaders(spreadsheetId: string, sheetName: string, headerRow = 1) {
        if (!this.isAvailable()) {
            throw new BadRequestException('Google Sheets integration not available');
        }

        return this.sheetsAdapter.getHeaders(spreadsheetId, sheetName, headerRow);
    }

    // === EMIT SYNC STATUS ===

    emitSyncStatus(event: string, data: unknown) {
        this.eventsGateway.server.emit(`google_sync:${event}`, data);
    }
}
