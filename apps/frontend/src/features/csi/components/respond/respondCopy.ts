/** UI copy for the respondent survey flow (exact approved wording). */
export const RESPOND_COPY = {
    start: 'Mulai mengisi',
    next: 'Lanjut',
    back: 'Kembali',
    toReview: 'Tinjau jawaban',
    submit: 'Kirim',
    edit: 'Ubah',
    name: 'Nama',
    department: 'Departemen',
    departmentPlaceholder: 'Pilih departemen',
    identity: 'Identitas Anda',
    resumed: 'Melanjutkan isian sebelumnya',
    chipsLabel: 'Daftar orang yang dinilai',
    chipComplete: 'lengkap',
    missingStar: 'Belum diberi bintang',
    commentPlaceholder: 'Tulis saran atau apresiasi…',
    reviewTitle: 'Tinjau jawaban',
    reviewHint: 'Periksa kembali sebelum mengirim. Survei hanya bisa dikirim sekali.',
    previewBanner: 'Pratinjau — jawaban tidak dikirim',
} as const;

export const summaryText = (people: number, minutes: number) => `Anda akan menilai ${people} orang · sekitar ${minutes} menit`;
export const deadlineText = (date: string) => `Tersedia sampai ${date}`;
export const positionText = (index: number, total: number) => `Orang ${index} dari ${total}`;
export const missingText = (count: number) => `Beri bintang untuk ${count} penilaian lagi`;
export const commentLabel = (name: string) => `Saran untuk ${name} (opsional)`;
export const ratingLabel = (dimension: string, name: string) => `${dimension} untuk ${name}`;
export const averageLabel = (value: string) => `Rata-rata ${value} dari 5 bintang`;
