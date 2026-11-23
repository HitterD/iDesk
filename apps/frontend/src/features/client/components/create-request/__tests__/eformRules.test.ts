import { describe, expect, it } from 'vitest';
import {
    addNasFolder, durationDays, efMissing, emailLocalPart, emptyEform, periodPresets, presetDates, toEformPayload, type EformForm,
} from '../eformRules';

const form = (over: Partial<EformForm> = {}): EformForm => ({ ...emptyEform('VPN', '2026-11-23'), need: 'NETWORK', reason: 'WFH', terms: true, signature: 'data:image/png;base64,AAAA', ...over });

describe('emailLocalPart', () => {
    it('forces lowercase letters, digits, dot, dash and underscore', () => {
        expect(emailLocalPart('Budi Santoso!@x')).toBe('budisantosox');
        expect(emailLocalPart('Budi.Santoso-1_a')).toBe('budi.santoso-1_a');
    });
});

describe('periodPresets and presetDates', () => {
    it('flashdisk also offers one day and one week; permanent kinds end with Permanen, others with +12 bln', () => {
        expect(periodPresets('FLASHDISK').map(([label]) => label)).toEqual(['+1 hari', '+1 minggu', '+1 bln', '+3 bln', '+6 bln', '+12 bln']);
        expect(periodPresets('VPN').map(([label]) => label)).toEqual(['+1 bln', '+3 bln', '+6 bln', '+12 bln']);
        expect(periodPresets('WEBSITE').map(([label]) => label).at(-1)).toBe('Permanen');
    });

    it('a preset gives an end date counted from the start; permanent gives none', () => {
        expect(presetDates('2026-11-23', 'm1')).toBe('2026-12-23');
        expect(presetDates('2026-11-23', 'm12')).toBe('2027-11-23');
        expect(presetDates('2026-11-23', 'd7')).toBe('2026-11-30');
        expect(presetDates('2026-11-23', 'perm')).toBeNull();
    });

    it('counts the days of a period', () => {
        expect(durationDays('2026-11-23', '2026-12-23')).toBe(30);
        expect(durationDays('2026-11-23', '2026-11-20')).toBe(-3);
    });
});

describe('efMissing', () => {
    it('a complete VPN request passes', () => {
        expect(efMissing(form({ to: '2027-01-01' }))).toBe('');
    });

    it.each([
        [{ kind: 'VPN', need: '' }, 'Pilih kebutuhan VPN'],
        [{ kind: 'WEBSITE', websites: ' ' }, 'Isi website yang diminta'],
        [{ kind: 'NETWORK', net: '' }, 'Isi tujuan jaringan'],
        [{ kind: 'FLASHDISK', host: '' }, 'Isi hostname PC'],
        [{ kind: 'EMAIL', email: '' }, 'Isi usulan alamat email'],
        [{ kind: 'SYNOLOGY_NAS', folders: [], shots: 0 }, 'Tambahkan minimal satu folder atau screenshot'],
        [{ kind: 'SYNOLOGY_NAS', acct: 'EXISTING', acctName: '', folders: [{ srv: 'NAS1', path: '/QC', rw: 'RO' }] }, 'Isi nama akun Synology'],
    ] as const)('names what is missing: %j', (over, message) => {
        expect(efMissing(form({ to: '2027-01-01', ...over } as Partial<EformForm>))).toBe(message);
    });

    it('VPN, Network and Flashdisk need an end date and at most 12 months; the end cannot be before the start', () => {
        expect(efMissing(form({ to: '' }))).toBe('Isi tanggal selesai');
        expect(efMissing(form({ to: '2026-11-20' }))).toBe('Tanggal selesai sebelum mulai');
        expect(efMissing(form({ to: '2027-12-23' }))).toBe('Maksimal 12 bulan');
        expect(efMissing(form({ to: '2027-11-24' }))).toBe('');
    });

    it('Email, Website and NAS may be permanent', () => {
        expect(efMissing(form({ kind: 'EMAIL', email: 'budi.santoso', to: '' }))).toBe('');
        expect(efMissing(form({ kind: 'WEBSITE', websites: 'a.com', to: '' }))).toBe('');
    });

    it('the purpose, the terms and the signature are always needed', () => {
        expect(efMissing(form({ to: '2027-01-01', reason: ' ' }))).toBe('Isi keperluan');
        expect(efMissing(form({ to: '2027-01-01', terms: false }))).toBe('Setujui syarat penggunaan');
        expect(efMissing(form({ to: '2027-01-01', signature: null }))).toBe('Tanda tangan dulu');
    });
});

describe('addNasFolder', () => {
    it('adds a folder, rejects an empty path and a path already on the same server', () => {
        const first = addNasFolder([], { srv: 'NAS1', path: '/QC/Laporan', rw: 'RO' });
        expect(first).toEqual({ folders: [{ srv: 'NAS1', path: '/QC/Laporan', rw: 'RO' }] });
        expect(addNasFolder(first.folders, { srv: 'NAS1', path: ' ', rw: 'RO' })).toEqual({ error: 'Isi path folder' });
        expect(addNasFolder(first.folders, { srv: 'NAS1', path: '/qc/laporan', rw: 'RW' })).toEqual({ error: 'Folder sudah ada' });
        expect(addNasFolder(first.folders, { srv: 'NAS2', path: '/QC/Laporan', rw: 'RO' }).folders).toHaveLength(2);
    });
});

describe('toEformPayload', () => {
    it('maps the form to the backend request: type, dates, form data, terms, signature', () => {
        const payload = toEformPayload(form({ to: '2027-01-01', dept: 'QC', managerId: 'm-1' }), 'Leony');
        expect(payload).toMatchObject({
            formType: 'VPN', startDate: '2026-11-23', endDate: '2027-01-01', termsAccepted: true, managerId: 'm-1',
            requesterName: 'Leony', requesterDepartment: 'QC', signatureData: 'data:image/png;base64,AAAA',
        });
        expect(payload.formData).toMatchObject({ alasan: 'WFH' });
    });

    it('a permanent access sends no end date; an email address is sent in full', () => {
        const payload = toEformPayload(form({ kind: 'EMAIL', email: 'budi.santoso', emailType: 'SHARING', to: '' }), 'Leony');
        expect(payload.endDate).toBeUndefined();
        expect(payload.formData).toMatchObject({ emailAddress: 'budi.santoso@kapalapi.co.id' });
    });
});
