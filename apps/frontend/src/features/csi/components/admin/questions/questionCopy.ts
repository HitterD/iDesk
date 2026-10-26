import type { CsiQuestionType } from '../../../types';

export const QUESTION_TYPE_ORDER: readonly CsiQuestionType[] = ['STAR', 'SCALE', 'CHOICE', 'TEXT'];
export const QUESTION_TYPE_LABELS: Readonly<Record<CsiQuestionType, string>> = {
    STAR: 'Bintang 1–5',
    SCALE: 'Pilihan berskala',
    CHOICE: 'Pilihan tanpa nilai',
    TEXT: 'Jawaban teks',
};

export const QUESTION_COPY = {
    tabLabel: 'Pertanyaan',
    listLabel: 'Daftar pertanyaan',
    handleNoun: 'pertanyaan',
    newQuestionName: 'Pertanyaan baru',
    add: 'Tambah pertanyaan',
    template: 'Gunakan template CSI 2025',
    templateTitle: 'Gunakan template CSI 2025?',
    templateDescription: 'Template menambahkan 9 pertanyaan di akhir daftar.',
    templateConfirm: 'Gunakan template',
    cancel: 'Batal',
    showInactive: 'Tampilkan nonaktif',
    empty: 'Belum ada pertanyaan. Tambahkan satu atau pakai template CSI 2025.',
    titleLabel: 'Pertanyaan',
    titlePlaceholder: 'Tulis pertanyaan…',
    titleEmpty: 'Pertanyaan tidak boleh kosong',
    descriptionLabel: 'Deskripsi (opsional)',
    descriptionPlaceholder: 'Penjelasan singkat untuk responden',
    typeGroup: 'Jenis pertanyaan',
    required: 'Wajib diisi',
    deactivate: 'Nonaktifkan',
    activate: 'Aktifkan',
    inactive: 'Nonaktif',
    saving: 'Menyimpan…',
    saved: 'Tersimpan',
    saveFailed: 'Gagal menyimpan',
    loadFailed: 'Gagal memuat pertanyaan.',
    createFailed: 'Gagal menambah pertanyaan.',
    reorderFailed: 'Gagal mengubah urutan.',
} as const;

export const OPTIONS_COPY = {
    group: 'Pilihan jawaban',
    add: 'Tambah pilihan',
    presets: 'Isi cepat',
    min: 'Minimal 2 pilihan',
    labelEmpty: 'Label pilihan tidak boleh kosong',
    handleNoun: 'pilihan',
    optionLabel: (position: number) => `Label pilihan ${position}`,
    optionPoints: (position: number) => `Poin pilihan ${position}`,
    remove: (label: string) => `Hapus pilihan ${label || 'kosong'}`,
    pointsHint: 'Poin',
} as const;

export const DEPARTMENT_COPY = {
    listLabel: 'Daftar departemen',
    handleNoun: 'departemen',
    addPlaceholder: 'Tambah departemen…',
    addLabel: 'Nama departemen baru',
    nameLabel: (name: string) => `Nama departemen ${name}`,
    empty: 'Belum ada departemen.',
    nameEmpty: 'Nama tidak boleh kosong',
    loadFailed: 'Gagal memuat departemen.',
    createFailed: 'Gagal menambah departemen.',
    reorderFailed: 'Gagal mengubah urutan.',
} as const;
