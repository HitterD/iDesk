import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface OcrResult {
    text: string;
    confidence: number;
    pages: number;
    success: boolean;
    error?: string;
}

/**
 * OCR Service for extracting text from scanned PDF documents.
 * 
 * SETUP INSTRUCTIONS:
 * To enable OCR functionality, install the following dependency:
 * 
 *   npm install tesseract.js
 * 
 * Without this dependency, scanned PDFs will require manual data entry.
 */
@Injectable()
export class PdfOcrService implements OnModuleInit {
    private readonly logger = new Logger(PdfOcrService.name);
    private tesseractAvailable = false;
    private recognizeFunction: ((image: any, langs: string, options?: any) => Promise<any>) | null = null;

    async onModuleInit() {
        // Lazy loading - Tesseract will be loaded on first use
        this.logger.log('PdfOcrService initialized (Tesseract will lazy-load on first use)');
    }

    private async initializeTesseract() {
        if (this.tesseractAvailable || this.recognizeFunction) {
            return; // Already initialized
        }

        try {
            // Use require to avoid compile-time errors
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const tesseract = require('tesseract.js');
            this.recognizeFunction = tesseract.recognize;
            this.tesseractAvailable = true;
            this.logger.log('✅ Tesseract.js loaded - OCR is available');
        } catch (error) {
            this.tesseractAvailable = false;
            this.logger.warn('⚠️ Tesseract.js not installed - OCR disabled. Run: npm install tesseract.js');
        }
    }

    /**
     * Performs OCR on an image file.
     * 
     * Note: For PDF files, you need to convert pages to images first using pdf-poppler.
     */
    async extractWithOcr(filePath: string): Promise<OcrResult> {
        // Lazy-load Tesseract on first use
        await this.initializeTesseract();

        if (!this.tesseractAvailable || !this.recognizeFunction) {
            return {
                text: '',
                confidence: 0,
                pages: 0,
                success: false,
                error: 'OCR not available. Install tesseract.js: npm install tesseract.js',
            };
        }

        try {
            this.logger.log(`Starting OCR for: ${path.basename(filePath)}`);

            if (!fs.existsSync(filePath)) {
                return {
                    text: '',
                    confidence: 0,
                    pages: 0,
                    success: false,
                    error: 'File not found',
                };
            }

            const imageBuffer = fs.readFileSync(filePath);

            const result = await this.recognizeFunction(imageBuffer, 'eng+ind', {
                logger: (m: { status: string; progress: number }) => {
                    if (m.status === 'recognizing text') {
                        this.logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });

            this.logger.log(`OCR completed with confidence: ${result.data.confidence}%`);

            return {
                text: result.data.text,
                confidence: result.data.confidence / 100,
                pages: 1,
                success: true,
            };
        } catch (error: any) {
            this.logger.error(`OCR failed: ${error.message}`);
            return {
                text: '',
                confidence: 0,
                pages: 0,
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Check if OCR is available
     */
    async isAvailable(): Promise<boolean> {
        await this.initializeTesseract();
        return this.tesseractAvailable;
    }

    /**
     * Get OCR availability status
     */
    getStatus(): { available: boolean; message: string } {
        if (this.tesseractAvailable) {
            return {
                available: true,
                message: 'Tesseract.js is available for OCR processing',
            };
        }
        return {
            available: false,
            message: 'OCR not available. Install with: npm install tesseract.js',
        };
    }
}
