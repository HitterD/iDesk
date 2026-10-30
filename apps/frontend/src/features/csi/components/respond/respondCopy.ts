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
    chipsLabel: 'Daftar bagian yang dinilai',
    railDone: 'Selesai',
    railDoneSuffix: 'selesai',
    railPending: 'Belum',
    autosaved: 'Tersimpan otomatis',
    allButton: 'Semua',
    allSubjects: 'Semua subjek',
    close: 'Tutup',
    scrollLeft: 'Geser kiri',
    scrollRight: 'Geser kanan',
    missingAnswer: 'Belum dijawab',
    required: 'wajib',
    commentPlaceholder: 'Tulis saran atau apresiasi…',
    reviewTitle: 'Tinjau jawaban',
    reviewHint: 'Periksa kembali sebelum mengirim. Survei hanya bisa dikirim sekali untuk setiap nama.',
    noScore: '—',
    notReady: 'Survei ini belum siap diisi. Silakan coba lagi nanti atau hubungi admin.',
    nameInvalid: 'Nama harus 2–150 karakter',
    thankYouTitle: 'Terima kasih!',
    fillAgain: 'Isi lagi atas nama orang lain',
    backToList: 'Kembali ke daftar survei',
} as const;

const TEAM_PREFIX = /^tim\s+/i;
export const summaryText = (people: number, minutes: number, teamLabel: string | null) => {
    const team = teamLabel ? `tim ${teamLabel.replace(TEAM_PREFIX, '')}` : null;
    const persons = people > 0 ? `${people} orang` : null;
    return `Anda akan menilai ${[team, persons].filter(Boolean).join(' dan ')} · sekitar ${minutes} menit`;
};
export const deadlineText = (date: string) => `Tersedia sampai ${date}`;
export const submittedNote = (names: string[]) => `Akun ini sudah mengisi atas nama: ${names.join(', ')}.`;
export const railPositionText = (index: number, total: number) => `Subjek ${index} dari ${total}`;
export const railDoneText = (count: number) => `· ${count} selesai`;
export const railAnsweredText = (answered: number, total: number) => `${answered}/${total} dijawab`;
export const popoverDoneText = (count: number, total: number) => `${count} dari ${total} selesai`;
export const thankYouName = (name: string) => `Terima kasih, ${name}!`;
export const thankYouSummary = (count: number) => `Penilaian Anda untuk ${count} subjek sudah terkirim.`;
export const missingText = (count: number) => `${count} pertanyaan wajib belum dijawab`;
export const commentLabel = (name: string) => `Saran untuk ${name} (opsional)`;
export const ratingLabel = (question: string, name: string) => `${question} untuk ${name}`;
export const averageLabel = (value: string) => `Rata-rata ${value} dari 5`;
export const otherAnswersText = (count: number) => `${count} jawaban lain`;
export const counterText = (length: number, max: number) => `${length}/${max}`;
