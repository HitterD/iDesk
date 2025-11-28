import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { ExtractionResult, IExtractionStrategy } from '../interfaces/extraction-strategy.interface';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

@Injectable()
export class PdfExtractionService {
    private readonly logger = new Logger(PdfExtractionService.name);
    private strategies: IExtractionStrategy[] = [];

    constructor() {
        this.strategies = [
            new AdobePatternStrategy(),
            new AlliedPatternStrategy(),
            new PoDateStrategy(),
            new GenericPatternStrategy(),
        ];
    }

    async extractFromFile(filePath: string): Promise<ExtractionResult> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            const text = pdfData.text;

            this.logger.debug(`Extracted ${text.length} characters from PDF`);

            for (const strategy of this.strategies) {
                if (strategy.canHandle(text)) {
                    this.logger.log(`Using strategy: ${strategy.name}`);
                    const result = strategy.extract(text);
                    result.rawText = text.substring(0, 2000);
                    return result;
                }
            }

            return {
                poNumber: null,
                vendorName: null,
                startDate: null,
                endDate: null,
                contractValue: null,
                description: null,
                confidence: 0,
                strategy: 'NONE',
                rawText: text.substring(0, 2000),
            };
        } catch (error) {
            this.logger.error(`PDF extraction failed: ${error.message}`);
            throw error;
        }
    }
}

// === STRATEGY IMPLEMENTATIONS ===

class AdobePatternStrategy implements IExtractionStrategy {
    name = 'ADOBE';

    canHandle(text: string): boolean {
        return text.includes('Kontrak Purchase Order') ||
            text.includes('Adobe') ||
            /Periode\s*:/i.test(text);
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Extract PO Number
        const poMatch = text.match(/(?:Kontrak\s+)?Purchase\s+Order\s*\(?PO\)?\s*(?:No\.?|:)?\s*([A-Z0-9\-\/]+)/i);
        if (poMatch) {
            result.poNumber = poMatch[1].trim();
            result.confidence += 0.25;
        }

        // Extract Date Range: "Periode: 1 November 2024 - 31 Oktober 2025"
        const periodeMatch = text.match(/Periode\s*:\s*(\d{1,2}\s+\w+\s+\d{4})\s*[-–]\s*(\d{1,2}\s+\w+\s+\d{4})/i);
        if (periodeMatch) {
            result.startDate = this.parseIndonesianDate(periodeMatch[1]);
            result.endDate = this.parseIndonesianDate(periodeMatch[2]);
            result.confidence += 0.5;
        }

        // Extract Vendor Name
        const vendorMatch = text.match(/(?:PT\.|CV\.|Vendor:?)\s*([A-Za-z\s\.]+?)(?:\n|,|$)/i);
        if (vendorMatch) {
            result.vendorName = vendorMatch[1].trim();
            result.confidence += 0.25;
        }

        // Try to extract description
        if (text.includes('Adobe')) {
            result.description = 'Adobe Software License';
        }

        return result;
    }

    private parseIndonesianDate(dateStr: string): Date | null {
        const months: Record<string, string> = {
            'januari': 'January', 'februari': 'February', 'maret': 'March',
            'april': 'April', 'mei': 'May', 'juni': 'June',
            'juli': 'July', 'agustus': 'August', 'september': 'September',
            'oktober': 'October', 'november': 'November', 'desember': 'December',
        };

        let normalized = dateStr.toLowerCase();
        for (const [id, en] of Object.entries(months)) {
            normalized = normalized.replace(id, en);
        }

        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
}

class AlliedPatternStrategy implements IExtractionStrategy {
    name = 'ALLIED';

    canHandle(text: string): boolean {
        return text.includes('NO. PO') ||
            text.includes('Allied') ||
            /Start\s+date/i.test(text);
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Extract PO Number: "NO. PO : P251580"
        const poMatch = text.match(/NO\.\s*PO\s*[:.]?\s*([A-Z0-9\-\/]+)/i);
        if (poMatch) {
            result.poNumber = poMatch[1].trim();
            result.confidence += 0.25;
        }

        // Extract Start Date
        const startMatch = text.match(/Start\s+date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
        if (startMatch) {
            result.startDate = this.parseIndonesianDate(startMatch[1]);
            result.confidence += 0.25;
        }

        // Extract End Date
        const endMatch = text.match(/End\s+Date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
        if (endMatch) {
            result.endDate = this.parseIndonesianDate(endMatch[1]);
            result.confidence += 0.25;
        }

        // Extract Vendor
        if (text.includes('Allied')) {
            result.vendorName = 'Allied';
            result.confidence += 0.25;
        }

        return result;
    }

    private parseIndonesianDate(dateStr: string): Date | null {
        const months: Record<string, string> = {
            'januari': 'January', 'februari': 'February', 'maret': 'March',
            'april': 'April', 'mei': 'May', 'juni': 'June',
            'juli': 'July', 'agustus': 'August', 'september': 'September',
            'oktober': 'October', 'november': 'November', 'desember': 'December',
        };

        let normalized = dateStr.toLowerCase();
        for (const [id, en] of Object.entries(months)) {
            normalized = normalized.replace(id, en);
        }

        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
}

class GenericPatternStrategy implements IExtractionStrategy {
    name = 'GENERIC';

    canHandle(text: string): boolean {
        return true;
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Try generic PO patterns
        const poPatterns = [
            /PO\s*(?:No\.?|Number|#)?\s*[:.]?\s*([A-Z0-9\-\/]+)/i,
            /Purchase\s+Order\s*[:.]?\s*([A-Z0-9\-\/]+)/i,
        ];

        for (const pattern of poPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.poNumber = match[1].trim();
                result.confidence += 0.15;
                break;
            }
        }

        // Try generic date patterns (DD/MM/YYYY or DD-MM-YYYY)
        const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
        const dates = [...text.matchAll(datePattern)];
        if (dates.length >= 2) {
            try {
                result.startDate = new Date(`${dates[0][3]}-${dates[0][2]}-${dates[0][1]}`);
                result.endDate = new Date(`${dates[1][3]}-${dates[1][2]}-${dates[1][1]}`);
                if (!isNaN(result.startDate.getTime()) && !isNaN(result.endDate.getTime())) {
                    result.confidence += 0.3;
                } else {
                    result.startDate = null;
                    result.endDate = null;
                }
            } catch {
                result.startDate = null;
                result.endDate = null;
            }
        }

        // Try to extract vendor name (PT. or CV.)
        const vendorMatch = text.match(/(?:PT\.|CV\.)\s*([A-Za-z\s\.]+?)(?:\n|,|$)/i);
        if (vendorMatch) {
            result.vendorName = vendorMatch[1].trim();
            result.confidence += 0.1;
        }

        return result;
    }
}

class PoDateStrategy implements IExtractionStrategy {
    name = 'PO_DATE_DICTIONARY';

    canHandle(text: string): boolean {
        const lower = text.toLowerCase();
        return lower.includes('no. po') ||
            (lower.includes('start date') && lower.includes('end date'));
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Extract PO Number: "NO. PO : ..."
        const poMatch = text.match(/NO\.?\s*PO\s*[:.]?\s*([A-Z0-9\-\/]+)/i);
        if (poMatch) {
            result.poNumber = poMatch[1].trim();
            result.confidence += 0.3;
        }

        // Extract Start Date: "start date : ..."
        const startMatch = text.match(/start\s+date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
        if (startMatch) {
            result.startDate = this.parseIndonesianDate(startMatch[1]);
            if (result.startDate) result.confidence += 0.3;
        }

        // Extract End Date: "end date : ..."
        const endMatch = text.match(/end\s+date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
        if (endMatch) {
            result.endDate = this.parseIndonesianDate(endMatch[1]);
            if (result.endDate) result.confidence += 0.3;
        }

        return result;
    }

    private parseIndonesianDate(dateStr: string): Date | null {
        const months: Record<string, string> = {
            'januari': 'January', 'februari': 'February', 'maret': 'March',
            'april': 'April', 'mei': 'May', 'juni': 'June',
            'juli': 'July', 'agustus': 'August', 'september': 'September',
            'oktober': 'October', 'november': 'November', 'desember': 'December',
        };

        let normalized = dateStr.toLowerCase();
        for (const [id, en] of Object.entries(months)) {
            normalized = normalized.replace(id, en);
        }

        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
}

