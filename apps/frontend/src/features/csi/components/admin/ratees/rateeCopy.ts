/** UI copy for the "Orang yang dinilai" step pickers. */
export const PEOPLE_COPY = {
    loading: 'Memuat subjek',
    noSubjects: 'Belum ada orang di "Subjek & foto". Cari nama di bawah, atau isi dulu tab Subjek & foto.',
    siteLabel: (site: string) => `Orang di ${site}`,
    pickSite: 'Pilih semua',
    clearSite: 'Batalkan semua',
    assigned: 'Sudah dipasang',
    searchOthers: 'Orang lain (tidak ada di Subjek & foto)',
    searchLabel: 'Cari orang lain yang dinilai',
} as const;

export const QUESTION_PICKER_COPY = {
    setsHint: 'Set pertanyaan (klik untuk memakai)',
    noSets: 'Belum ada set. Centang pertanyaan lalu "Simpan sebagai set" agar bisa dipakai ulang.',
    selected: (count: number, total: number) => `${count} dari ${total} pertanyaan dipilih`,
    pickAll: 'Pilih semua',
    clearAll: 'Kosongkan',
    saveAsSet: 'Simpan sebagai set',
    saveSet: 'Simpan set',
    cancel: 'Batal',
    setNameLabel: 'Nama set pertanyaan',
    setNamePlaceholder: 'Mis. Set individu standar',
    setSaved: 'Set pertanyaan disimpan',
    deleteSet: (name: string) => `Hapus set ${name}`,
    applySet: (name: string, count: number) => `Pakai set ${name} (${count} pertanyaan)`,
} as const;
