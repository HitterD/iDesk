import type { CsiDimension, CsiScopeParam } from '../types';

const TEMPLATE_2025_NAMES: readonly string[] = [
    'Dalam 1 tahun terakhir, berapa kali Bapak/Ibu meminta bantuan IT Support melalui platform iDesk / Whatsapp / Telepon?',
    'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini [Kecepatan respon IT Support terhadap laporan dari pengguna]',
    'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini [IT Support bersikap ramah dan mampu menerima penjelasan terhadap masalah yang dihadapi dengan baik]',
    'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini [Kemampuan diagnosa IT Support terhadap permasalahan yang dilaporkan]',
    'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini [Kemampuan IT Support dalam memberikan solusi atau menyelesaikan permasalahan]',
    'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini [Kecepatan IT Support dalam memberikan solusi atau menangani permasalahan sesuai target yang disepakati]',
    'Bagaimana Anda menilai kemampuan komunikasi IT Support?',
    'Jika anda meminta penjelasan terhadap masalah yang dihadapi. Bagaimana penilaian anda terhadap penjelasan yang diberikan tim IT Support kepada anda?',
    'Bagaimana penilaian anda terhadap kualitas pelayanan tim IT Support secara keseluruhan?',
];

const TEMPLATE_HC_NAMES: readonly string[] = [
    'Knowledge — Pengetahuan/pemahaman PIC terkait jasa atau pelayanan',
    'Responsiveness — Kecepatan respon terhadap permintaan atau keluhan pelayanan',
    'Courtesy — Kesopanan / keramahan dalam melayani dan menerima keluhan',
    'Communication — Kemampuan menyampaikan informasi secara tepat',
    'Tangible — Terpenuhinya kebutuhan pelayanan',
];

export const normalizeQuestionKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function templateQuestionNames(scope: CsiScopeParam): readonly string[] {
    return scope === 'hc' ? TEMPLATE_HC_NAMES : TEMPLATE_2025_NAMES;
}

export function templateLabel(scope: CsiScopeParam): string {
    return scope === 'hc' ? 'Template 5 dimensi' : 'Template CSI 2025';
}

export interface TemplateMatchResult {
    ids: string[];
    missingCount: number;
}

/** Matches canonical template questions (in template order) against active dimensions. */
export function matchTemplateDimensions(scope: CsiScopeParam, dimensions: readonly CsiDimension[]): TemplateMatchResult {
    const byKey = new Map(dimensions.map((dimension) => [normalizeQuestionKey(dimension.name), dimension.id]));
    const names = templateQuestionNames(scope);
    const ids: string[] = [];
    let missingCount = 0;
    for (const name of names) {
        const id = byKey.get(normalizeQuestionKey(name));
        if (id) ids.push(id);
        else missingCount += 1;
    }
    return { ids, missingCount };
}
