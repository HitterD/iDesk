import { CsiOption, CsiQuestionType } from './csi.constants';

const scored = (labels: string[]): CsiOption[] => labels.map((label, index) => ({ label, points: labels.length - index }));

export const CSI_PRESET_SATISFACTION = scored(['Sangat puas', 'Puas', 'Netral', 'Tidak puas', 'Sangat tidak puas']);
export const CSI_PRESET_QUALITY = scored(['Sangat baik', 'Baik', 'Cukup', 'Buruk', 'Sangat buruk']);
export const CSI_PRESET_FREQUENCY: CsiOption[] = ['< 5 kali', '5 - 10 kali', '> 10 kali'].map((label) => ({ label, points: null }));

const SATISFACTION_PREFIX = 'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini ';
const satisfaction = (aspect: string) => ({
    type: CsiQuestionType.SCALE, name: `${SATISFACTION_PREFIX}[${aspect}]`, options: CSI_PRESET_SATISFACTION,
});
const star = (name: string) => ({ type: CsiQuestionType.STAR, name, options: [] as CsiOption[] });

/** The CSI 2025 questionnaire, verbatim except "E-Services" → "iDesk". */
export const CSI_TEMPLATE_2025: ReadonlyArray<{ type: CsiQuestionType; name: string; options: CsiOption[] }> = [
    {
        type: CsiQuestionType.CHOICE, options: CSI_PRESET_FREQUENCY,
        name: 'Dalam 1 tahun terakhir, berapa kali Bapak/Ibu meminta bantuan IT Support melalui platform iDesk / Whatsapp / Telepon?',
    },
    satisfaction('Kecepatan respon IT Support terhadap laporan dari pengguna'),
    satisfaction('IT Support bersikap ramah dan mampu menerima penjelasan terhadap masalah yang dihadapi dengan baik'),
    satisfaction('Kemampuan diagnosa IT Support terhadap permasalahan yang dilaporkan'),
    satisfaction('Kemampuan IT Support dalam memberikan solusi atau menyelesaikan permasalahan'),
    satisfaction('Kecepatan IT Support dalam memberikan solusi atau menangani permasalahan sesuai target yang disepakati'),
    star('Bagaimana Anda menilai kemampuan komunikasi IT Support?'),
    {
        type: CsiQuestionType.SCALE, options: CSI_PRESET_QUALITY,
        name: 'Jika anda meminta penjelasan terhadap masalah yang dihadapi. Bagaimana penilaian anda terhadap penjelasan yang diberikan tim IT Support kepada anda?',
    },
    star('Bagaimana penilaian anda terhadap kualitas pelayanan tim IT Support secara keseluruhan?'),
];
