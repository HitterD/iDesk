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
    departmentOnce: 'Pastikan benar: departemen tidak bisa diubah setelah dipilih.',
    identity: 'Identitas Anda',
    identityLocked: 'Identitas mengikuti akun Anda. Setiap akun hanya dapat mengisi survei ini satu kali.',
    resumed: 'Melanjutkan isian sebelumnya',
    chipsLabel: 'Daftar bagian yang dinilai',
    railDone: 'Selesai',
    railDoneSuffix: 'selesai',
    railPending: 'Belum',
    autosaved: 'Tersimpan otomatis',
    allButton: 'Semua',
    allSubjects: 'Semua yang Anda nilai',
    close: 'Tutup',
    scrollLeft: 'Geser kiri',
    scrollRight: 'Geser kanan',
    missingAnswer: 'Belum dijawab',
    missingComment: 'Saran wajib diisi',
    incompleteBadge: 'Belum lengkap',
    required: 'wajib',
    commentPlaceholder: 'Tulis saran atau apresiasi…',
    reviewTitle: 'Tinjau jawaban',
    reviewHint: 'Periksa kembali sebelum mengirim. Survei hanya bisa dikirim satu kali untuk setiap akun.',
    noScore: '—',
    notReady: 'Survei ini belum siap diisi. Silakan coba lagi nanti atau hubungi admin.',
    thankYouTitle: 'Terima kasih!',
    backToList: 'Kembali ke daftar survei',
    alreadyAnsweredTitle: 'Anda sudah mengisi survei ini',
    nextSurveyLabel: 'Masih ada survei untuk Anda',
    nextSurveyCta: 'Isi sekarang',
} as const;

const TEAM_PREFIX = /^tim\s+/i;
export const summaryText = (people: number, minutes: number, teamLabel: string | null) => {
    const team = teamLabel ? `tim ${teamLabel.replace(TEAM_PREFIX, '')}` : null;
    const persons = people > 0 ? `${people} orang` : null;
    return `Anda akan menilai ${[team, persons].filter(Boolean).join(' dan ')} · sekitar ${minutes} menit`;
};
export const deadlineText = (date: string) => `Tersedia sampai ${date}`;
export const answeredOnText = (date: string) => `Jawaban Anda terkirim pada ${date}. Terima kasih atas penilaiannya.`;
export const moreSurveysText = (count: number) => `${count} survei lain belum Anda isi`;
export const railPositionText = (index: number, total: number) => `Penilaian ${index} dari ${total}`;
export const railDoneText = (count: number) => `· ${count} selesai`;
export const railAnsweredText = (answered: number, total: number) => `${answered}/${total} dijawab`;
export const popoverDoneText = (count: number, total: number) => `${count} dari ${total} selesai`;
export const thankYouName = (name: string) => `Terima kasih, ${name}!`;
export const thankYouSummary = (count: number) => `Penilaian Anda untuk ${count} tim/orang sudah terkirim.`;
export const confirmDepartmentText = (name: string) => `Departemen Anda: ${name}. Pilihan ini tidak bisa diubah lagi untuk survei berikutnya. Sudah benar?`;
export const missingText = (count: number) => `${count} pertanyaan wajib belum dijawab`;
export const missingSummary = (questionCount: number, commentMissing: boolean) => {
    if (questionCount > 0 && commentMissing) return `${questionCount} pertanyaan wajib dan saran belum diisi`;
    if (questionCount > 0) return missingText(questionCount);
    return commentMissing ? RESPOND_COPY.missingComment : '';
};
export const reviewIncompleteHint = (count: number) => `Masih ada ${count} tim/orang yang belum lengkap penilaian atau sarannya.`;
export const commentLabel = (name: string) => `Saran untuk ${name}`;
export const ratingLabel = (question: string, name: string) => `${question} untuk ${name}`;
export const averageLabel = (value: string) => `Rata-rata ${value} dari 5`;
export const otherAnswersText = (count: number) => `${count} jawaban lain`;
export const counterText = (length: number, max: number) => `${length}/${max}`;
