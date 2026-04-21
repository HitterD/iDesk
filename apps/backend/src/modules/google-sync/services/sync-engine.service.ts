import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In, DataSource } from 'typeorm';
import { SpreadsheetSheet, SyncDirection, SheetDataType, ColumnMapping } from '../entities/spreadsheet-sheet.entity';
import { SyncLog, SyncLogDirection, SyncStatus, ConflictDetail } from '../entities/sync-log.entity';
import { GoogleSheetsAdapter, SheetRow } from '../adapters/google-sheets.adapter';
import { RenewalContract } from '../../renewal/entities/renewal-contract.entity';
import { VpnAccess } from '../../vpn-access/entities/vpn-access.entity';
import { EventsGateway } from '../../ticketing/presentation/gateways/events.gateway';

export interface SyncResult {
    status: SyncStatus;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    recordsSkipped: number;
    conflictsResolved: number;
    conflictDetails: ConflictDetail[];
    errorMessage?: string;
    durationMs: number;
}

/**
 * Core sync engine implementing two-way synchronization with conflict resolution
 */
@Injectable()
export class SyncEngineService {
    private readonly logger = new Logger(SyncEngineService.name);
    private readonly BATCH_SIZE = 100;

    constructor(
        @InjectRepository(SpreadsheetSheet)
        private readonly sheetRepo: Repository<SpreadsheetSheet>,
        @InjectRepository(SyncLog)
        private readonly logRepo: Repository<SyncLog>,
        @InjectRepository(RenewalContract)
        private readonly renewalRepo: Repository<RenewalContract>,
        @InjectRepository(VpnAccess)
        private readonly vpnRepo: Repository<VpnAccess>,
        private readonly sheetsAdapter: GoogleSheetsAdapter,
        private readonly eventsGateway: EventsGateway,
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Execute sync for a specific sheet mapping
     */
    async syncSheet(sheetId: string, triggeredById?: string): Promise<SyncResult> {
        const startTime = Date.now();

        const sheet = await this.sheetRepo.findOne({
            where: { id: sheetId },
            relations: ['config'],
        });

        if (!sheet || !sheet.syncEnabled) {
            return this.createErrorResult('Sheet not found or sync disabled', startTime);
        }

        if (!this.sheetsAdapter.isReady()) {
            return this.createErrorResult('Google Sheets API not initialized', startTime);
        }

        this.emitSyncEvent('sync_started', { sheetId, sheetName: sheet.sheetName });

        try {
            let result: SyncResult;

            switch (sheet.syncDirection) {
                case SyncDirection.PUSH:
                    result = await this.pushToSheet(sheet);
                    break;
                case SyncDirection.PULL:
                    result = await this.pullFromSheet(sheet);
                    break;
                case SyncDirection.BOTH:
                    result = await this.twoWaySync(sheet);
                    break;
                default:
                    result = this.createErrorResult('Unknown sync direction', startTime);
            }

            result.durationMs = Date.now() - startTime;

            // Save sync log
            await this.saveSyncLog(sheet, result, triggeredById);

            // Update sheet last sync time
            await this.sheetRepo.update(sheet.id, {
                lastSyncAt: new Date(),
                lastSyncError: result.status === SyncStatus.SUCCESS ? null : result.errorMessage,
                syncErrorCount: result.status === SyncStatus.SUCCESS ? 0 : sheet.syncErrorCount + 1,
            });

            this.emitSyncEvent('sync_completed', {
                sheetId,
                sheetName: sheet.sheetName,
                result,
            });

            return result;

        } catch (error) {
            const errorResult = this.createErrorResult(error.message, startTime);
            await this.saveSyncLog(sheet, errorResult, triggeredById);

            this.emitSyncEvent('sync_failed', {
                sheetId,
                sheetName: sheet.sheetName,
                error: error.message,
            });

            return errorResult;
        }
    }

    /**
     * Push iDesk data to Google Sheet
     */
    private async pushToSheet(sheet: SpreadsheetSheet): Promise<SyncResult> {
        const result: SyncResult = this.createEmptyResult();

        const records = await this.getLocalRecords(sheet);
        const sheetRows = await this.sheetsAdapter.readSheet(
            sheet.config.spreadsheetId,
            {
                sheetName: sheet.sheetName,
                headerRow: sheet.headerRow,
                dataStartRow: sheet.dataStartRow,
            }
        );

        const headers = sheet.columnMapping.map(m => m.sheetColumn);
        const newRows: unknown[][] = [];
        const rowsToUpdate: Array<{ range: string; values: unknown[][] }> = [];

        // Enforce the header row
        const headerValues = sheet.columnMapping.map(m => m.sheetColumn);
        rowsToUpdate.push({
            range: `${sheet.sheetName}!A${sheet.headerRow}`,
            values: [headerValues],
        });

        // Track rows meant to be deleted completely from the sheet
        const rowsToDelete: number[] = [];

        // Create lookup for existing sheet rows by ID
        const idField = this.getIdField(sheet.dataType);
        const sheetRowMap = new Map<string, SheetRow>();
        sheetRows.forEach(row => {
            const id = String(row.values[idField] || '');
            if (id) sheetRowMap.set(id, row);
        });

        for (const record of records) {
            const recordId = String(record.id || '');
            const existingRow = sheetRowMap.get(recordId);
            const isLocalDeleted = !!record['deletedAt'];

            if (existingRow) {
                if (isLocalDeleted) {
                    rowsToDelete.push(existingRow.rowIndex);
                    result.recordsDeleted++;
                    continue; // Skip updating this row, it will be destroyed
                }

                // Update existing row (in-place update via batch write later)
                const rowValues = this.recordToRow(record, sheet.columnMapping);
                rowsToUpdate.push({
                    range: `${sheet.sheetName}!A${existingRow.rowIndex}`,
                    values: [rowValues],
                });
                result.recordsUpdated++;
            } else {
                if (isLocalDeleted) continue; // Already deleted, and doesn't exist on sheet. Proceed.
                // New record - append
                const rowValues = this.recordToRow(record, sheet.columnMapping);
                newRows.push(rowValues);
                result.recordsCreated++;
            }
        }

        // Execute batch updates for modified rows and headers
        if (rowsToUpdate.length > 0) {
            await this.sheetsAdapter.batchWrite(sheet.config.spreadsheetId, rowsToUpdate);
        }

        // Execute hard-deletes on the sheet
        if (rowsToDelete.length > 0) {
            const metadata = await this.sheetsAdapter.getSpreadsheetMetadata(sheet.config.spreadsheetId);
            const sheetMeta = metadata.sheets.find(s => s.title === sheet.sheetName);
            if (sheetMeta) {
                await this.sheetsAdapter.deleteRows(sheet.config.spreadsheetId, sheetMeta.sheetId, rowsToDelete);
            } else {
                this.logger.warn(`Could not find sheetGid for deletion on sheet ${sheet.sheetName}`);
            }
        }

        // Batch append new rows
        if (newRows.length > 0) {
            await this.batchAppend(sheet, newRows);
        }

        result.status = SyncStatus.SUCCESS;
        return result;
    }

    /**
     * Pull data from Google Sheet to iDesk
     */
    private async pullFromSheet(sheet: SpreadsheetSheet): Promise<SyncResult> {
        const result: SyncResult = this.createEmptyResult();

        const sheetRows = await this.sheetsAdapter.readSheet(
            sheet.config.spreadsheetId,
            {
                sheetName: sheet.sheetName,
                headerRow: sheet.headerRow,
                dataStartRow: sheet.dataStartRow,
            }
        );

        for (const row of sheetRows) {
            try {
                const record = this.rowToRecord(row.values, sheet.columnMapping, sheet.dataType);
                const recordId = record.id ? String(record.id) : null;

                if (recordId) {
                    // Update existing
                    const existing = await this.findLocalRecord(sheet.dataType, recordId);
                    if (existing) {
                        await this.updateLocalRecord(sheet.dataType, recordId, record);
                        result.recordsUpdated++;
                    } else {
                        result.recordsSkipped++;
                    }
                } else {
                    // Create new
                    await this.createLocalRecord(sheet.dataType, record);
                    result.recordsCreated++;
                }
            } catch (error) {
                this.logger.warn(`Failed to process row: ${error.message}`);
                result.recordsSkipped++;
            }
        }

        result.status = SyncStatus.SUCCESS;
        return result;
    }

    /**
     * Two-way sync with Last-Write-Wins conflict resolution
     */
    private async twoWaySync(sheet: SpreadsheetSheet): Promise<SyncResult> {
        const result: SyncResult = this.createEmptyResult();

        // Get data from both sources
        const localRecords = await this.getLocalRecords(sheet);
        const sheetRows = await this.sheetsAdapter.readSheet(
            sheet.config.spreadsheetId,
            {
                sheetName: sheet.sheetName,
                headerRow: sheet.headerRow,
                dataStartRow: sheet.dataStartRow,
            }
        );

        const idField = this.getIdField(sheet.dataType);
        const updatedAtField = 'updatedAt';

        // Create lookups
        const localMap = new Map(localRecords.map(r => [String(r.id), r]));
        const sheetMap = new Map<string, SheetRow>();
        const newSheetRows: SheetRow[] = [];
        sheetRows.forEach(row => {
            const id = String(row.values[idField] || '');
            if (id) {
                sheetMap.set(id, row);
            } else {
                newSheetRows.push(row);
            }
        });

        // Process all IDs from both sources
        const allIds = new Set([...localMap.keys(), ...sheetMap.keys()]);
        const rowsToUpdate: Array<{ range: string; values: unknown[][] }> = [];
        const rowsToAppend: unknown[][] = [];
        const rowsToDelete: number[] = [];

        // ALways ensure the header row perfectly mirrors the column mapping.
        // If the 'id' header is missing in the sheet, this will gently add it back,
        // preventing infinite record duplication on subsequent syncs.
        const headerValues = sheet.columnMapping.map(m => m.sheetColumn);
        rowsToUpdate.push({
            range: `${sheet.sheetName}!A${sheet.headerRow}`,
            values: [headerValues],
        });

        for (const id of allIds) {
            const localRecord = localMap.get(id);
            const sheetRow = sheetMap.get(id);
            const isLocalDeleted = localRecord && !!localRecord['deletedAt'];

            if (localRecord && sheetRow) {
                if (isLocalDeleted) {
                    rowsToDelete.push(sheetRow.rowIndex);
                    result.recordsDeleted++;
                    continue; // Skip resolving edits, just destroy the sheet row.
                }

                // Both exist - compare timestamps for conflict resolution
                const localUpdatedVal = localRecord[updatedAtField];
                const localUpdated = localUpdatedVal ? new Date(String(localUpdatedVal)).getTime() : 0;
                const sheetUpdatedValue = sheetRow.values[updatedAtField];
                const sheetUpdated = sheetUpdatedValue ? new Date(String(sheetUpdatedValue)).getTime() : 0;

                if (localUpdated > sheetUpdated) {
                    // Local is newer - push to sheet
                    const rowValues = this.recordToRow(localRecord, sheet.columnMapping);
                    rowsToUpdate.push({
                        range: `${sheet.sheetName}!A${sheetRow.rowIndex}`,
                        values: [rowValues],
                    });
                    result.recordsUpdated++;

                    if (sheetUpdated > 0) {
                        result.conflictsResolved++;
                        result.conflictDetails.push({
                            recordId: id,
                            field: 'all',
                            iDeskValue: localUpdated,
                            sheetValue: sheetUpdated,
                            resolvedTo: 'IDESK',
                            resolvedAt: new Date().toISOString(),
                        });
                    }
                } else if (sheetUpdated > localUpdated) {
                    // Sheet is newer - pull to iDesk
                    const record = this.rowToRecord(sheetRow.values, sheet.columnMapping, sheet.dataType);
                    await this.updateLocalRecord(sheet.dataType, id, record);
                    result.recordsUpdated++;

                    result.conflictsResolved++;
                    result.conflictDetails.push({
                        recordId: id,
                        field: 'all',
                        iDeskValue: localUpdated,
                        sheetValue: sheetUpdated,
                        resolvedTo: 'SHEET',
                        resolvedAt: new Date().toISOString(),
                    });
                }
                // Equal timestamps - no action needed
            } else if (localRecord && !sheetRow) {
                if (isLocalDeleted) continue; // It's deleted locally and missing from sheet, skip.
                // Only in iDesk - push to sheet
                const rowValues = this.recordToRow(localRecord, sheet.columnMapping);
                rowsToAppend.push(rowValues);
                result.recordsCreated++;
            } else if (!localRecord && sheetRow) {
                // Only in sheet - pull to iDesk
                const record = this.rowToRecord(sheetRow.values, sheet.columnMapping, sheet.dataType);
                await this.createLocalRecord(sheet.dataType, record);
                result.recordsCreated++;
            }
        }

        // Handle new rows from sheet (no ID)
        for (const newRow of newSheetRows) {
            try {
                const record = this.rowToRecord(newRow.values, sheet.columnMapping, sheet.dataType);
                const savedRecord = await this.createLocalRecord(sheet.dataType, record);
                result.recordsCreated++;

                // Now push this back to the sheet to save the newly generated DB ID
                const rowValues = this.recordToRow(savedRecord, sheet.columnMapping);
                rowsToUpdate.push({
                    range: `${sheet.sheetName}!A${newRow.rowIndex}`,
                    values: [rowValues],
                });
            } catch (error) {
                this.logger.warn(`Failed to process new sheet row: ${error.message} - ${error.stack}`);
                result.recordsSkipped++;
            }
        }

        // Batch update existing rows
        if (rowsToUpdate.length > 0) {
            await this.sheetsAdapter.batchWrite(sheet.config.spreadsheetId, rowsToUpdate);
        }

        // Execute hard-deletes on sheet
        if (rowsToDelete.length > 0) {
            const metadata = await this.sheetsAdapter.getSpreadsheetMetadata(sheet.config.spreadsheetId);
            const sheetMeta = metadata.sheets.find(s => s.title === sheet.sheetName);
            if (sheetMeta) {
                await this.sheetsAdapter.deleteRows(sheet.config.spreadsheetId, sheetMeta.sheetId, rowsToDelete);
            }
        }

        // Batch append new rows
        if (rowsToAppend.length > 0) {
            await this.batchAppend(sheet, rowsToAppend);
        }

        result.status = result.conflictsResolved > 0 ? SyncStatus.CONFLICT : SyncStatus.SUCCESS;
        return result;
    }

    // === Helper Methods ===

    private async getLocalRecords(sheet: SpreadsheetSheet): Promise<Record<string, unknown>[]> {
        switch (sheet.dataType) {
            case SheetDataType.RENEWAL:
                const renewals = await this.renewalRepo.find({
                    order: { updatedAt: 'DESC' },
                    take: 1000,
                    withDeleted: true,
                });
                return renewals.map(r => r as unknown as Record<string, unknown>);
            case SheetDataType.VPN:
                const vpns = await this.vpnRepo.find({
                    order: { updatedAt: 'DESC' },
                    take: 1000,
                    withDeleted: true,
                });
                return vpns.map(v => v as unknown as Record<string, unknown>);
            default:
                this.logger.warn(`Unknown dataType: ${sheet.dataType}`);
                return [];
        }
    }

    private async findLocalRecord(dataType: SheetDataType, id: string): Promise<unknown> {
        switch (dataType) {
            case SheetDataType.RENEWAL:
                return this.renewalRepo.findOne({ where: { id } });
            case SheetDataType.VPN:
                return this.vpnRepo.findOne({ where: { id } });
            default:
                return null;
        }
    }

    private async createLocalRecord(dataType: SheetDataType, data: Record<string, unknown>): Promise<any> {
        // Normalize Enums safely
        this.normalizeEnums(dataType, data);

        switch (dataType) {
            case SheetDataType.RENEWAL:
                const contract = this.renewalRepo.create(data as Partial<RenewalContract>);
                if (contract.id) {
                    await this.renewalRepo.insert(contract);
                    return await this.renewalRepo.findOne({ where: { id: contract.id } });
                }
                return await this.renewalRepo.save(contract);
            case SheetDataType.VPN:
                const vpn = this.vpnRepo.create(data as Partial<VpnAccess>);
                if (vpn.id) {
                    await this.vpnRepo.insert(vpn);
                    return await this.vpnRepo.findOne({ where: { id: vpn.id } });
                }
                return await this.vpnRepo.save(vpn);
            default:
                throw new Error(`Unsupported dataType: ${dataType}`);
        }
    }

    private async updateLocalRecord(dataType: SheetDataType, id: string, data: Record<string, unknown>): Promise<void> {
        this.normalizeEnums(dataType, data);
        switch (dataType) {
            case SheetDataType.RENEWAL:
                await this.renewalRepo.update(id, data as Partial<RenewalContract>);
                break;
            case SheetDataType.VPN:
                await this.vpnRepo.update(id, data as Partial<VpnAccess>);
                break;
        }
    }

    private normalizeEnums(dataType: SheetDataType, data: Record<string, unknown>) {
        if (dataType === SheetDataType.VPN) {
            if (data.area) {
                const a = String(data.area).toLowerCase();
                if (a.includes('jakarta')) data.area = 'Jakarta';
                else if (a.includes('karawang')) data.area = 'Karawang';
                else if (a.includes('sepanjang')) data.area = 'Sepanjang';
                else if (a.includes('semarang')) data.area = 'Semarang';
            }
            if (data.statusCreateVpn) {
                const s = String(data.statusCreateVpn).toLowerCase();
                if (s.includes('selesai')) data.statusCreateVpn = 'Selesai';
                else if (s.includes('proses')) data.statusCreateVpn = 'Proses';
                else if (s.includes('batal')) data.statusCreateVpn = 'Batal';
                else if (s.includes('non')) data.statusCreateVpn = 'Non Aktif';
            }
        }
    }

    private recordToRow(record: Record<string, unknown>, mapping: ColumnMapping[]): unknown[] {
        return mapping.map(m => {
            const value = record[m.iDeskField];
            return this.formatValue(value, m.type);
        });
    }

    private rowToRecord(values: Record<string, unknown>, mapping: ColumnMapping[], dataType: SheetDataType): Record<string, unknown> {
        const record: Record<string, unknown> = {};

        for (const m of mapping) {
            const value = values[m.sheetColumn];
            const parsed = this.parseValue(value, m.type);
            if (parsed !== null) {
                record[m.iDeskField] = parsed;
            }
        }

        return record;
    }

    private formatValue(value: unknown, type: string): unknown {
        if (value === null || value === undefined) return '';

        switch (type) {
            case 'date':
                return value instanceof Date ? value.toISOString() : String(value);
            case 'boolean':
                return value ? 'TRUE' : 'FALSE';
            default:
                return value;
        }
    }

    private parseValue(value: unknown, type: string): unknown {
        if (value === null || value === undefined || value === '') return null;

        switch (type) {
            case 'number':
                return Number(value);
            case 'date':
                if (typeof value === 'number') {
                    // Google Sheets serial date (days since Dec 30, 1899)
                    return new Date((value - 25569) * 86400 * 1000);
                }
                const parsedDate = new Date(String(value));
                return isNaN(parsedDate.getTime()) ? null : parsedDate;
            case 'boolean':
                return String(value).toLowerCase() === 'true';
            default:
                return String(value);
        }
    }

    private getIdField(dataType: SheetDataType): string {
        return 'id'; // All entities use 'id' as primary key
    }

    private async batchAppend(sheet: SpreadsheetSheet, rows: unknown[][]): Promise<void> {
        for (let i = 0; i < rows.length; i += this.BATCH_SIZE) {
            const batch = rows.slice(i, i + this.BATCH_SIZE);
            await this.sheetsAdapter.appendRows(
                sheet.config.spreadsheetId,
                sheet.sheetName,
                batch,
            );
            // Rate limiting delay
            if (i + this.BATCH_SIZE < rows.length) {
                await this.delay(1000);
            }
        }
    }

    private async saveSyncLog(sheet: SpreadsheetSheet, result: SyncResult, triggeredById?: string): Promise<void> {
        const log = this.logRepo.create({
            sheetId: sheet.id,
            triggeredById,
            direction: sheet.syncDirection as any, // Save the actual SyncDirection (BOTH, PUSH, PULL)
            status: result.status,
            recordsCreated: result.recordsCreated,
            recordsUpdated: result.recordsUpdated,
            recordsDeleted: result.recordsDeleted,
            recordsSkipped: result.recordsSkipped,
            conflictsResolved: result.conflictsResolved,
            conflictDetails: result.conflictDetails,
            errorMessage: result.errorMessage,
            durationMs: result.durationMs,
        });
        await this.logRepo.save(log);
    }

    private createEmptyResult(): SyncResult {
        return {
            status: SyncStatus.SUCCESS,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsDeleted: 0,
            recordsSkipped: 0,
            conflictsResolved: 0,
            conflictDetails: [],
            durationMs: 0,
        };
    }

    private createErrorResult(message: string, startTime: number): SyncResult {
        return {
            status: SyncStatus.FAILED,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsDeleted: 0,
            recordsSkipped: 0,
            conflictsResolved: 0,
            conflictDetails: [],
            errorMessage: message,
            durationMs: Date.now() - startTime,
        };
    }

    private emitSyncEvent(event: string, data: unknown): void {
        this.eventsGateway.server.emit(`google_sync:${event}`, data);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry an async operation with exponential backoff
     * Handles transient Google API failures (rate limits, network issues)
     */
    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        operationName: string,
        maxRetries: number = 3,
        baseDelayMs: number = 1000,
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Check if it's a retryable error (rate limit, network issue)
                const isRetryable = this.isRetryableError(error);

                if (!isRetryable || attempt === maxRetries) {
                    this.logger.error(`${operationName} failed after ${attempt} attempt(s): ${error.message}`);
                    throw error;
                }

                // Exponential backoff: 1s, 2s, 4s, ...
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
                this.logger.warn(
                    `${operationName} attempt ${attempt} failed, retrying in ${delayMs}ms: ${error.message}`
                );
                await this.delay(delayMs);
            }
        }

        throw lastError!;
    }

    /**
     * Check if an error is retryable (network/rate limit issues)
     */
    private isRetryableError(error: any): boolean {
        // Google API rate limit errors
        if (error?.code === 429 || error?.response?.status === 429) {
            return true;
        }

        // Google API quota exceeded
        if (error?.code === 403 && error?.message?.includes('quota')) {
            return true;
        }

        // Network errors
        if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
            return true;
        }

        // Generic server errors (5xx)
        if (error?.response?.status >= 500 && error?.response?.status < 600) {
            return true;
        }

        return false;
    }
}

