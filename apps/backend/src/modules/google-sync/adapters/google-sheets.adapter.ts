import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface SheetRow {
    rowIndex: number;
    values: Record<string, unknown>;
}

export interface SheetMetadata {
    sheetId: number;
    title: string;
    index: number;
    rowCount: number;
    columnCount: number;
}

export interface ReadOptions {
    sheetName: string;
    headerRow: number;
    dataStartRow: number;
    range?: string; // Optional A1 notation range
}

export interface WriteOptions {
    sheetName: string;
    headerRow: number;
    dataStartRow: number;
}

/**
 * Adapter for Google Sheets API operations
 * Implements the Adapter pattern for Clean Architecture
 */
@Injectable()
export class GoogleSheetsAdapter implements OnModuleInit {
    private readonly logger = new Logger(GoogleSheetsAdapter.name);
    private sheets: sheets_v4.Sheets;
    private authClient: JWT;
    private isInitialized = false;

    constructor(private readonly configService: ConfigService) { }

    async onModuleInit() {
        // Lazy initialization - don't make network calls during startup
        // Auth will happen on first actual API use via ensureInitialized()
        const credentialsPath = this.configService.get<string>('GOOGLE_CREDENTIALS_PATH');
        if (credentialsPath) {
            this.logger.log('Google Sheets adapter configured (lazy initialization)');
        } else {
            this.logger.warn('GOOGLE_CREDENTIALS_PATH not set. Google Sync disabled.');
        }
    }

    /**
     * Ensure the adapter is initialized before making API calls
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }
    }

    /**
     * Initialize the Google Sheets API client
     */
    async initialize(): Promise<void> {
        try {
            const credentialsPath = this.configService.get<string>('GOOGLE_CREDENTIALS_PATH');

            if (!credentialsPath) {
                this.logger.warn('GOOGLE_CREDENTIALS_PATH not set. Google Sync disabled.');
                return;
            }

            const resolvedPath = path.resolve(credentialsPath);

            if (!fs.existsSync(resolvedPath)) {
                this.logger.warn(`Google credentials file not found: ${resolvedPath}`);
                return;
            }

            const credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

            this.authClient = new JWT({
                email: credentials.client_email,
                key: credentials.private_key,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.readonly',
                ],
            });

            await this.authClient.authorize();

            this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
            this.isInitialized = true;

            this.logger.log('Google Sheets API initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Google Sheets API:', error);
        }
    }

    /**
     * Check if the adapter is ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Get spreadsheet metadata including all sheets
     */
    async getSpreadsheetMetadata(spreadsheetId: string): Promise<{
        title: string;
        sheets: SheetMetadata[];
    }> {
        await this.ensureInitialized();

        const response = await this.sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'properties.title,sheets.properties',
        });

        const title = response.data.properties?.title || '';
        const sheets: SheetMetadata[] = (response.data.sheets || []).map(sheet => ({
            sheetId: sheet.properties?.sheetId || 0,
            title: sheet.properties?.title || '',
            index: sheet.properties?.index || 0,
            rowCount: sheet.properties?.gridProperties?.rowCount || 0,
            columnCount: sheet.properties?.gridProperties?.columnCount || 0,
        }));

        return { title, sheets };
    }

    /**
     * Read all rows from a sheet
     */
    async readSheet(spreadsheetId: string, options: ReadOptions): Promise<SheetRow[]> {
        await this.ensureInitialized();

        const range = options.range || `${options.sheetName}!A${options.headerRow}:ZZ`;

        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'SERIAL_NUMBER',
        });

        const rows = response.data.values || [];
        if (rows.length === 0) return [];

        // First row is headers
        const headers = rows[0].map(String);
        const dataRows: SheetRow[] = [];

        // Start from dataStartRow (accounting for 0-based array vs 1-based row numbers)
        const dataOffset = options.dataStartRow - options.headerRow;

        for (let i = dataOffset; i < rows.length; i++) {
            const row = rows[i];
            const values: Record<string, unknown> = {};

            headers.forEach((header, colIndex) => {
                if (header) {
                    values[header] = row[colIndex] ?? null;
                }
            });

            // Only include rows that have at least one non-empty value
            if (Object.values(values).some(v => v !== null && v !== '')) {
                dataRows.push({
                    rowIndex: options.headerRow + i, // Actual row number in sheet
                    values,
                });
            }
        }

        return dataRows;
    }

    /**
     * Write rows to a sheet (append or update)
     */
    async writeRows(
        spreadsheetId: string,
        options: WriteOptions,
        rows: Record<string, unknown>[],
        headers: string[],
    ): Promise<number> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        if (rows.length === 0) return 0;

        // Convert records to 2D array
        const values = rows.map(row =>
            headers.map(header => row[header] ?? '')
        );

        const range = `${options.sheetName}!A${options.dataStartRow}`;

        await this.sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        return rows.length;
    }

    /**
     * Append rows to the end of a sheet
     */
    async appendRows(
        spreadsheetId: string,
        sheetName: string,
        rows: unknown[][],
    ): Promise<number> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        if (rows.length === 0) return 0;

        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rows },
        });

        return response.data.updates?.updatedRows || 0;
    }

    /**
     * Update a specific row
     */
    async updateRow(
        spreadsheetId: string,
        sheetName: string,
        rowIndex: number,
        values: unknown[],
    ): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        await this.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });
    }

    /**
     * Delete rows by clearing them (sheets don't support true row deletion via values API)
     */
    async clearRows(
        spreadsheetId: string,
        sheetName: string,
        startRow: number,
        endRow: number,
    ): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        await this.sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${sheetName}!A${startRow}:ZZ${endRow}`,
        });
    }

    /**
     * Get the headers from a sheet
     */
    async getHeaders(
        spreadsheetId: string,
        sheetName: string,
        headerRow: number = 1,
    ): Promise<string[]> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A${headerRow}:ZZ${headerRow}`,
        });

        return (response.data.values?.[0] || []).map(String);
    }

    /**
     * Batch read multiple ranges
     */
    async batchRead(
        spreadsheetId: string,
        ranges: string[],
    ): Promise<Record<string, unknown[][]>> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        const response = await this.sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const result: Record<string, unknown[][]> = {};

        (response.data.valueRanges || []).forEach((valueRange, index) => {
            result[ranges[index]] = valueRange.values || [];
        });

        return result;
    }

    /**
     * Physically delete rows from a sheet completely, altering grid dimensions
     */
    async deleteRows(
        spreadsheetId: string,
        sheetId: number,
        rowIndices: number[]
    ): Promise<number> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        if (rowIndices.length === 0) return 0;

        // Sort descending so deleting higher indices doesn't pull up the lower ones
        const sortedIndices = [...rowIndices].sort((a, b) => b - a);

        const requests = sortedIndices.map(index => ({
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: index - 1, // 0-based index
                    endIndex: index, // Exclusive
                }
            }
        }));

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests,
            },
        });

        return sortedIndices.length;
    }

    /**
     * Batch update multiple ranges
     */
    async batchWrite(
        spreadsheetId: string,
        data: Array<{ range: string; values: unknown[][] }>,
    ): Promise<number> {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        if (data.length === 0) return 0;

        const response = await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: data.map(d => ({
                    range: d.range,
                    values: d.values,
                })),
            },
        });

        return response.data.totalUpdatedCells || 0;
    }
}
