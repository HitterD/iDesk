/**
 * Centralized Error Messages
 * Maps standardized error codes (from backend) to user-friendly messages in Indonesian
 * 
 * Error Code Format: {DOMAIN}_{NUMBER}
 * - AUTH: Authentication & Authorization
 * - CSRF: CSRF Protection
 * - RATE: Rate Limiting
 * - TKT: Tickets
 * - USR: Users
 * - VAL: Validation
 * - SYS: System
 * - ZOOM: Zoom Integration
 * - KB: Knowledge Base
 * - NTF: Notifications
 * - FILE: File Uploads
 * - NET: Network
 */

export const ERROR_MESSAGES: Record<string, string> = {
    // ==========================================
    // AUTH - Authentication & Authorization
    // ==========================================
    'AUTH_001': 'Email atau password salah.',
    'AUTH_002': 'Sesi anda telah berakhir. Silakan login kembali.',
    'AUTH_003': 'Token tidak valid.',
    'AUTH_004': 'Anda tidak memiliki akses ke fitur ini.',
    'AUTH_005': 'Akun anda telah dinonaktifkan. Hubungi administrator.',
    'AUTH_006': 'Sesi anda telah berakhir.',
    'AUTH_007': 'Verifikasi dua langkah diperlukan.',
    'AUTH_008': 'Password saat ini salah.',
    'AUTH_009': 'Password tidak memenuhi persyaratan keamanan.',

    // ==========================================
    // CSRF - Cross-Site Request Forgery
    // ==========================================
    'CSRF_001': 'Token keamanan tidak ditemukan. Muat ulang halaman.',
    'CSRF_002': 'Token keamanan tidak valid. Muat ulang halaman.',
    'CSRF_003': 'Token keamanan kadaluarsa. Muat ulang halaman.',

    // ==========================================
    // RATE - Rate Limiting
    // ==========================================
    'RATE_001': 'Terlalu banyak permintaan. Coba lagi nanti.',
    'RATE_002': 'Batas koneksi terlampaui. Coba lagi nanti.',
    'RATE_003': 'Pesan terlalu cepat. Tunggu sebentar.',

    // ==========================================
    // TKT - Tickets
    // ==========================================
    'TKT_001': 'Tiket tidak ditemukan. Mungkin sudah dihapus.',
    'TKT_002': 'Tiket sudah ditutup dan tidak dapat diubah.',
    'TKT_003': 'SLA telah terlampaui. Segera tangani tiket ini.',
    'TKT_004': 'Perubahan status tidak valid.',
    'TKT_005': 'Ukuran file lampiran terlalu besar.',
    'TKT_006': 'Agent yang ditugaskan tidak ditemukan.',
    'TKT_007': 'Tiket serupa sudah ada.',
    'TKT_008': 'Tiket ini sedang dikunci.',

    // ==========================================
    // USR - Users
    // ==========================================
    'USR_001': 'User tidak ditemukan.',
    'USR_002': 'Email sudah terdaftar.',
    'USR_003': 'Role user tidak valid.',
    'USR_004': 'Anda tidak dapat menghapus akun sendiri.',
    'USR_005': 'Departemen wajib diisi untuk role ini.',
    'USR_006': 'Preset permission tidak ditemukan.',

    // ==========================================
    // VAL - Validation
    // ==========================================
    'VAL_001': 'Field wajib tidak boleh kosong.',
    'VAL_002': 'Format data tidak valid.',
    'VAL_003': 'Nilai field melebihi batas maksimal.',
    'VAL_004': 'Nilai field terlalu pendek.',
    'VAL_005': 'Format email tidak valid.',
    'VAL_006': 'Format tanggal tidak valid.',
    'VAL_007': 'Format ID tidak valid.',

    // ==========================================
    // SYS - System
    // ==========================================
    'SYS_001': 'Terjadi kesalahan. Coba lagi atau hubungi support.',
    'SYS_002': 'Operasi database gagal.',
    'SYS_003': 'Layanan eksternal tidak tersedia.',
    'SYS_004': 'Kesalahan konfigurasi sistem.',
    'SYS_005': 'Fitur ini sedang dinonaktifkan.',
    'SYS_006': 'Sistem sedang dalam maintenance.',

    // ==========================================
    // ZOOM - Zoom Integration
    // ==========================================
    'ZOOM_001': 'Integrasi Zoom belum dikonfigurasi.',
    'ZOOM_002': 'Gagal autentikasi dengan Zoom.',
    'ZOOM_003': 'Meeting Zoom tidak ditemukan.',
    'ZOOM_004': 'Jadwal bentrok dengan booking lain.',
    'ZOOM_005': 'Slot waktu sudah tidak tersedia.',

    // ==========================================
    // KB - Knowledge Base
    // ==========================================
    'KB_001': 'Artikel tidak ditemukan.',
    'KB_002': 'Kategori tidak ditemukan.',
    'KB_003': 'Artikel dengan URL ini sudah ada.',

    // ==========================================
    // NTF - Notifications
    // ==========================================
    'NTF_001': 'Notifikasi tidak ditemukan.',
    'NTF_002': 'Notifikasi sudah ditandai dibaca.',
    'NTF_003': 'Gagal mengirim notifikasi.',

    // ==========================================
    // FILE - File Uploads
    // ==========================================
    'FILE_001': 'Ukuran file terlalu besar. Maksimal 10MB.',
    'FILE_002': 'Tipe file tidak didukung.',
    'FILE_003': 'Gagal mengunggah file. Coba lagi.',
    'FILE_004': 'File tidak ditemukan.',

    // ==========================================
    // NET - Network
    // ==========================================
    'NET_001': 'Koneksi ke layanan gagal.',
    'NET_002': 'Permintaan timeout. Coba lagi.',

    // ==========================================
    // Legacy codes (backward compatibility)
    // ==========================================
    'UNAUTHORIZED': 'Sesi anda telah berakhir. Silakan login kembali.',
    'INVALID_CREDENTIALS': 'Email atau password salah.',
    'FORBIDDEN': 'Anda tidak memiliki akses ke fitur ini.',
    'VALIDATION_ERROR': 'Data yang dimasukkan tidak valid.',
    'INTERNAL_ERROR': 'Terjadi kesalahan. Coba lagi atau hubungi support.',
    'NETWORK_ERROR': 'Koneksi terputus. Periksa koneksi internet anda.',
    'TIMEOUT': 'Permintaan timeout. Coba lagi.',
    'SERVICE_UNAVAILABLE': 'Layanan sedang tidak tersedia.',
    'UNKNOWN_ERROR': 'Terjadi kesalahan yang tidak diketahui.',
    'SESSION_EXPIRED': 'Sesi anda telah berakhir. Silakan login kembali.',
};

/**
 * Gets a user-friendly error message
 * @param errorCode - The error code from the API (e.g., 'AUTH_001', 'TKT_001')
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
    400: 'VAL_001',
    401: 'AUTH_002',
    403: 'AUTH_004',
    404: 'SYS_001',
    408: 'NET_002',
    413: 'FILE_001',
    429: 'RATE_001',
    500: 'SYS_001',
    502: 'SYS_003',
    503: 'SYS_006',
    504: 'NET_002',
};

/**
 * Gets an error message based on HTTP status code
 */
export function getErrorMessageFromStatus(status: number): string {
    const errorCode = HTTP_STATUS_TO_ERROR[status];
    return errorCode ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN_ERROR'] : ERROR_MESSAGES['UNKNOWN_ERROR'];
}

