export enum ContractStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    EXPIRING_SOON = 'EXPIRING_SOON',
    EXPIRED = 'EXPIRED',
}

export interface RenewalContract {
    id: string;
    poNumber: string | null;
    vendorName: string | null;
    description: string | null;
    contractValue: number | null;
    startDate: string | null;
    endDate: string | null;
    originalFileName: string;
    filePath: string;
    fileSize: number | null;
    status: ContractStatus;
    extractionStrategy: string | null;
    extractionConfidence: number | null;
    
    // Reminder tracking
    reminderD60Sent: boolean;
    reminderD30Sent: boolean;
    reminderD7Sent: boolean;
    reminderD1Sent: boolean;
    
    // Acknowledge feature
    isAcknowledged: boolean;
    acknowledgedAt: string | null;
    acknowledgedById: string | null;
    acknowledgedBy: {
        id: string;
        fullName: string;
    } | null;
    
    uploadedBy: {
        id: string;
        fullName: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface DashboardStats {
    total: number;
    active: number;
    expiringSoon: number;
    expired: number;
    draft: number;
}

export interface ExtractionResult {
    poNumber: string | null;
    vendorName: string | null;
    startDate: string | null;
    endDate: string | null;
    contractValue: number | null;
    description: string | null;
    confidence: number;
    strategy: string;
}

export interface ValidationInfo {
    characterCount: number;
    isScannedImage: boolean;
    rawTextPreview?: string;
    wasForced?: boolean;
}

export interface UploadResponse {
    contract: RenewalContract;
    extraction: ExtractionResult;
    validation?: ValidationInfo;
}

export interface UploadWarningResponse {
    success: false;
    warning: string;
    validation: ValidationInfo;
    message: string;
}

export type UploadResult = UploadResponse | UploadWarningResponse;

export function isUploadWarning(result: UploadResult): result is UploadWarningResponse {
    return 'success' in result && result.success === false;
}

export interface UpdateContractDto {
    poNumber?: string;
    vendorName?: string;
    description?: string;
    contractValue?: number;
    startDate?: string;
    endDate?: string;
}
