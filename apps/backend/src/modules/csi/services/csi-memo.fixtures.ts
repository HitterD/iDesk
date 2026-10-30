import { CsiRespondentMode } from '../csi.constants';
import { MemoHeaderDto } from '../dto/memo.dto';

/** Shared fixtures for memo specs (not shipped logic). */
export const memoHeader = (overrides: Partial<MemoHeaderDto> = {}): MemoHeaderDto => ({
    to: 'Bapak Direktur', cc: 'Manager HC', number: '001/IM/ICT-SJA1/XI/2025', from: 'ICT Manager',
    subject: 'Nilai CSI Operational Support 2025', date: '2025-11-28',
    opening: 'Sehubungan dengan telah berakhirnya penilaian CSI, maka berikut adalah Nilai CSI 2025.',
    closing: 'Demikian informasi dari kami.\nAtas perhatian dan kerja samanya kami mengucapkan terima kasih.',
    signerLeft: { name: 'Budi Santoso', title: 'ICT Supervisor' }, signerRight: { name: 'Siti Aminah', title: 'ICT Manager' },
    ...overrides,
});

const q = (name: string, type: string) => ({ name, type, average: null, count: 0, distribution: [] });
const score = (dimension: string, type: string, value: number | null, answerLabel: string | null = null, answerText: string | null = null) =>
    ({ dimension, type, score: value, answerLabel, answerText });

export function memoSurvey(index = 1, averageValue: number | null = 4.52) {
    const sites = index === 1
        ? [{ id: 's1', code: 'A-SPJ', name: 'SJA Sepanjang' }, { id: 's2', code: 'B-SKD', name: 'SJA Sukodono' }]
        : [{ id: 's3', code: 'KRW', name: 'SJA Karawang' }];
    const report = {
        period: {
            id: `p${index}`, title: `CSI Operational Support ${index}`, respondentMode: CsiRespondentMode.OPEN,
            teamLabel: 'Tim IT Support', sites,
        },
        overall: { average: averageValue, respondentCount: 2 },
        sla: {
            mode: CsiRespondentMode.OPEN, basis: 3, targetPct: 80, target: 3, responses: 2, pengisiPct: 100,
            reporters: [
                { email: 'a@sja.co.id', department: 'Finance', fullName: 'Andi' },
                { email: 'b@sja.co.id', department: 'HR', fullName: 'Bela' },
                { email: 'c@sja.co.id', department: null, fullName: 'Citra' },
            ],
        },
        ratees: [
            { periodRateeId: 't', kind: 'TEAM', displayName: 'Tim IT Support', average: 4, questions: [q('Kecepatan', 'STAR')] },
            ...(index === 1 ? [
                { periodRateeId: 'r1', kind: 'PERSON', displayName: 'Budi Hartono', average: 4.5, questions: [q('Ramah', 'STAR'), q('Channel', 'CHOICE')] },
                { periodRateeId: 'r2', kind: 'PERSON', displayName: 'Dewi Lestari', average: 4.5, questions: [q('Ramah', 'STAR'), q('Channel', 'CHOICE')] },
            ] : []),
        ],
    };
    const answers = [{
        responseId: 'x', respondentName: 'titi yusliyanti', accountName: 'akun', areaName: 'Sepanjang', departmentName: 'Keuangan',
        submittedAt: new Date('2025-11-03T08:14:32Z'),
        ratees: [
            { periodRateeId: 't', kind: 'TEAM', displayName: 'Tim IT Support', jobTitle: null, comment: null, scores: [score('Kecepatan', 'STAR', 4)] },
            ...(index === 1 ? [{
                periodRateeId: 'r1', kind: 'PERSON', displayName: 'Budi Hartono', jobTitle: null, comment: null,
                scores: [score('Ramah', 'STAR', 5), score('Channel', 'CHOICE', null, 'Email')],
            }] : []),
        ],
    }];
    return { report: report as any, answers: answers as any };
}
