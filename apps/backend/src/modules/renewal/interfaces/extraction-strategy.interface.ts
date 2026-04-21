export interface ExtractionResult {
    poNumber: string | null;
    vendorName: string | null;
    startDate: Date | null;
    endDate: Date | null;
    contractValue: number | null;
    description: string | null;
    confidence: number;
    strategy: string;
    rawText?: string;
}

export interface IExtractionStrategy {
    name: string;
    canHandle(text: string): boolean;
    extract(text: string): ExtractionResult;
}
