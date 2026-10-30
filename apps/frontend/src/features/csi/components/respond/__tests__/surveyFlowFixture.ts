import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { CsiOpenForm } from '../../../types';

export const LONG_NAME = 'Budi Santoso Wijaya Kusuma dari Divisi Jaringan';
const SCALE_OPTIONS = [{ label: 'Sangat baik', points: 5 }, { label: 'Cukup', points: 3 }, { label: 'Kurang', points: 1 }];

const SPJ = { siteId: 's1', siteCode: 'SPJ' };

/** The TEAM ratee sits in the middle on purpose: the flow must still show it first. */
export const FORM: CsiOpenForm = {
    teamLabel: 'Tim IT Support', submittedNames: [], id: 'p1', scope: 'ICT', title: 'Survei Kepuasan ICT Q4', intro: 'Mohon nilai layanan kami.',
    endDate: '2026-10-31', respondent: { fullName: 'Rina Pemohon' },
    departments: [{ id: 'd1', name: 'Finance' }, { id: 'd2', name: 'Produksi' }],
    ratees: [
        { periodRateeId: 'r1', kind: 'PERSON', displayName: 'Andi', jobTitle: 'IT Support', avatarUrl: null, ...SPJ, tagline: null, photoUrl: null, dimensions: [
            { periodRateeDimensionId: 'x1', name: 'Kecepatan', description: 'Seberapa cepat ditanggapi', type: 'STAR', required: true, options: [] },
            { periodRateeDimensionId: 'x2', name: 'Keramahan', description: null, type: 'STAR', required: true, options: [] },
            { periodRateeDimensionId: 'x3', name: 'Catatan', description: null, type: 'TEXT', required: false, options: [] },
        ] },
        { periodRateeId: 'rt', kind: 'TEAM', displayName: 'Tim IT Support', jobTitle: null, avatarUrl: null, ...SPJ, tagline: 'Selalu siap membantu', photoUrl: null, dimensions: [
            { periodRateeDimensionId: 't1', name: 'Kualitas layanan', description: null, type: 'SCALE', required: true, options: SCALE_OPTIONS },
            { periodRateeDimensionId: 't2', name: 'Frekuensi gangguan', description: null, type: 'CHOICE', required: false,
                options: [{ label: 'Sering', points: null }, { label: 'Jarang', points: null }] },
        ] },
        { periodRateeId: 'r2', kind: 'PERSON', displayName: LONG_NAME, jobTitle: null, avatarUrl: '/uploads/budi.png', ...SPJ, tagline: null, photoUrl: '/uploads/budi.png', dimensions: [
            { periodRateeDimensionId: 'y1', name: 'Kecepatan', description: null, type: 'STAR', required: true, options: [] },
        ] },
    ],
};

export type User = ReturnType<typeof userEvent.setup>;

/** The next button reads "Lanjut · <next name>". */
export const NEXT = /^Lanjut/;
export const button = (name: string | RegExp) => screen.getByRole('button', { name });
export const chips = () => within(screen.getByRole('navigation', { name: 'Daftar bagian yang dinilai' }));

export const rate = (user: User, group: string, stars: number) =>
    user.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: `${stars} bintang` }));
export const choose = (user: User, group: string, option: string) =>
    user.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));

export async function startFilling(user: User, department = 'Produksi') {
    await user.click(await screen.findByRole('combobox', { name: 'Departemen' }));
    await user.click(await screen.findByRole('option', { name: department }));
    await user.click(button('Mulai mengisi'));
}

/** Team → Andi → Budi with every required answer, ending on the review screen. */
export async function answerAll(user: User, comment?: string) {
    await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Cukup');
    await user.click(button(NEXT));
    await rate(user, 'Kecepatan untuk Andi', 5);
    await rate(user, 'Keramahan untuk Andi', 4);
    if (comment) await user.type(screen.getByLabelText('Saran untuk Andi (opsional)'), comment);
    await user.click(button(NEXT));
    await rate(user, `Kecepatan untuk ${LONG_NAME}`, 3);
    await user.click(button('Tinjau jawaban'));
}

export const EXPECTED_ITEMS = [
    { periodRateeDimensionId: 't1', optionIndex: 1 },
    { periodRateeDimensionId: 'x1', score: 5 },
    { periodRateeDimensionId: 'x2', score: 4 },
    { periodRateeDimensionId: 'y1', score: 3 },
];
