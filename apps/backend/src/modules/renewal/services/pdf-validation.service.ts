import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

const pdfParse = require('pdf-parse');

export interface PdfValidationResult {
    isValid: boolean;
    characterCount: number;
    isScannedImage: boolean;
    warningMessage?: string;
    rawTextPreview?: string;
}

@Injectable()
export class PdfValidationService {
    private readonly logger = new Logger(PdfValidationService.name);

    // Minimum characters to consider PDF as having extractable text
    private readonly MIN_TEXT_THRESHOLD = 50;

    /**
     * Validates if a PDF has extractable text or is a scanned image.
     * @param filePath - Path to the PDF file
     * @returns PdfValidationResult with validation details
     */
    async validatePdf(filePath: string): Promise<PdfValidationResult> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);

            // Clean text: remove excessive whitespace
            const cleanedText = pdfData.text
                .replace(/\s+/g, ' ')
                .trim();

            const characterCount = cleanedText.length;
            const isScannedImage = characterCount < this.MIN_TEXT_THRESHOLD;

            this.logger.debug(
                `PDF validation: ${characterCount} chars extracted ` +
                `(threshold: ${this.MIN_TEXT_THRESHOLD})`
            );

            if (isScannedImage) {
                return {
                    isValid: false,
                    characterCount,
                    isScannedImage: true,
                    warningMessage:
                        'Warning: This file appears to be a scanned image. ' +
                        'Please upload a digital PDF with selectable text ' +
                        'to ensure accurate data extraction.',
                    rawTextPreview: cleanedText.substring(0, 200),
                };
            }

            return {
                isValid: true,
                characterCount,
                isScannedImage: false,
                rawTextPreview: cleanedText.substring(0, 200),
            };
        } catch (error) {
            this.logger.error(`PDF validation failed: ${error.message}`);

            return {
                isValid: false,
                characterCount: 0,
                isScannedImage: true,
                warningMessage:
                    'Error: Unable to read PDF content. ' +
                    'The file may be corrupted or password-protected.',
            };
        }
    }

    /**
     * Get the minimum text threshold
     */
    getMinThreshold(): number {
        return this.MIN_TEXT_THRESHOLD;
    }
}
