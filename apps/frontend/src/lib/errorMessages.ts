/**
 * Centralized Error Messages
 * Maps error codes to user-friendly messages in Indonesian
 */

export const ERROR_MESSAGES: Record<string, string> = {
    // Authentication errors
    'UNAUTHORIZED': 'Sesi anda telah berakhir. Silakan login kembali.',
    'INVALID_CREDENTIALS': 'Email atau password salah.',
    'ACCOUNT_DISABLED': 'Akun anda telah dinonaktifkan. Hubungi administrator.',
    'SESSION_EXPIRED': 'Sesi anda telah berakhir. Silakan login kembali.',
    'TOKEN_EXPIRED': 'Token tidak valid atau sudah kadaluarsa.',
    'FORBIDDEN': 'Anda tidak memiliki akses ke fitur ini.',

    // Ticket errors
    'TICKET_NOT_FOUND': 'Tiket tidak ditemukan. Mungkin sudah dihapus.',
    'TICKET_CLOSED': 'Tiket sudah ditutup dan tidak dapat diubah.',
    'TICKET_ALREADY_ASSIGNED': 'Tiket sudah ditugaskan ke agent lain.',
    'INVALID_STATUS_TRANSITION': 'Perubahan status tidak valid.',
    'SLA_BREACH': 'SLA telah terlampaui. Segera tangani tiket ini.',

    // User errors  
    'USER_NOT_FOUND': 'User tidak ditemukan.',
    'EMAIL_ALREADY_EXISTS': 'Email sudah terdaftar.',
    'INVALID_PASSWORD': 'Password tidak memenuhi persyaratan keamanan.',

    // Validation errors
    'VALIDATION_ERROR': 'Data yang dimasukkan tidak valid.',
    'REQUIRED_FIELD': 'Field wajib tidak boleh kosong.',
    'INVALID_EMAIL': 'Format email tidak valid.',
    'INVALID_PHONE': 'Format nomor telepon tidak valid.',

    // File errors
    'FILE_TOO_LARGE': 'Ukuran file terlalu besar. Maksimal 10MB.',
    'INVALID_FILE_TYPE': 'Tipe file tidak didukung.',
    'UPLOAD_FAILED': 'Gagal mengunggah file. Coba lagi.',

    // Network errors
    'NETWORK_ERROR': 'Koneksi terputus. Periksa koneksi internet anda.',
    'TIMEOUT': 'Permintaan timeout. Coba lagi.',
    'SERVICE_UNAVAILABLE': 'Layanan sedang tidak tersedia. Coba beberapa saat lagi.',

    // Knowledge Base
    'ARTICLE_NOT_FOUND': 'Artikel tidak ditemukan.',
    'CATEGORY_NOT_FOUND': 'Kategori tidak ditemukan.',

    // Generic
    'INTERNAL_ERROR': 'Terjadi kesalahan. Coba lagi atau hubungi support.',
    'UNKNOWN_ERROR': 'Terjadi kesalahan yang tidak diketahui.',
};

/**
 * Gets a user-friendly error message
 * @param errorCode - The error code from the API
 * @param fallbackMessage - Optional fallback message from the API response
 * @returns User-friendly error message
 */
export function getErrorMessage(
    errorCode?: string | null,
    fallbackMessage?: string | string[]
): string {
    // If we have a known error code, use our mapped message
    if (errorCode && ERROR_MESSAGES[errorCode]) {
        return ERROR_MESSAGES[errorCode];
    }

    // If the API provided a message, use it (handling arrays from class-validator)
    if (fallbackMessage) {
        if (Array.isArray(fallbackMessage)) {
            return fallbackMessage.join(', ');
        }
        return fallbackMessage;
    }

    // Default fallback
    return ERROR_MESSAGES['UNKNOWN_ERROR'];
}

/**
 * Common HTTP status code to error code mapping
 */
export const HTTP_STATUS_TO_ERROR: Record<number, string> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    408: 'TIMEOUT',
    500: 'INTERNAL_ERROR',
    502: 'SERVICE_UNAVAILABLE',
    503: 'SERVICE_UNAVAILABLE',
    504: 'TIMEOUT',
};

/**
 * Gets an error message based on HTTP status code
 */
export function getErrorMessageFromStatus(status: number): string {
    const errorCode = HTTP_STATUS_TO_ERROR[status];
    return errorCode ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN_ERROR'] : ERROR_MESSAGES['UNKNOWN_ERROR'];
}
