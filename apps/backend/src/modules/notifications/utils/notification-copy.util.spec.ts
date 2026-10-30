import { describeTicketChanges, picOf, withWho } from './notification-copy.util';

describe('describeTicketChanges', () => {
    it('reads the change list in Indonesian', () => {
        expect(describeTicketChanges(
            'Status changed from TODO to IN_PROGRESS, Ticket reassigned to Agent B (was Beny Saputra, S.Kom) (Alasan: cuti), SLA Timer started. Target: 2026-10-24T03:00:00.000Z',
        )).toBe('Status: Baru → Dikerjakan; PIC kini Agent B');
        expect(describeTicketChanges('Priority changed from MEDIUM to CRITICAL')).toBe('Prioritas: Normal → Blocker');
        expect(describeTicketChanges('Status changed from RESOLVED to CLOSED')).toBe('Status: Selesai → Ditutup');
    });

    it.each([
        ['Status changed from RESOLVED to CLOSED (otomatis, batas konfirmasi terlewati)', 'Ditutup otomatis: tidak dikonfirmasi dalam batas waktu'],
        ['Status changed from RESOLVED to CLOSED (dikonfirmasi pemohon)', 'Ditutup: penyelesaian dikonfirmasi pemohon'],
        ['Status changed from IN_PROGRESS to CLOSED (ditandai selesai oleh pemohon)', 'Ditutup: ditandai selesai oleh pemohon'],
        ['Status changed from RESOLVED to IN_PROGRESS (disanggah pemohon)', 'Dibuka kembali: penyelesaian disanggah pemohon'],
    ])('translates the resolution flow note of %s', (changes, expected) => {
        expect(describeTicketChanges(changes)).toBe(expected);
    });

    it('never leaks raw English or ISO timestamps', () => {
        const text = describeTicketChanges(
            'Status changed from IN_PROGRESS to RESOLVED, Menunggu konfirmasi pemohon hingga 2026-10-29T09:00:00.000Z',
        );
        expect(text).toBe('Status: Dikerjakan → Selesai');
    });

    it('reads bulk edits and takeovers', () => {
        expect(describeTicketChanges('Status: TODO → IN_PROGRESS, Assigned to: Rizky Ardiansyah (Alasan: cuti)'))
            .toBe('Status: Baru → Dikerjakan; PIC kini Rizky Ardiansyah');
        expect(describeTicketChanges('Ticket reassigned to Rizky (was Budi) by Rizky. Alasan: PIC cuti')).toBe('PIC kini Rizky');
    });

    it('keeps entries it does not recognise', () => {
        expect(describeTicketChanges('Janji vendor: Kamis, 29 Oktober 2026 09.00 WIB')).toBe('Janji vendor: Kamis, 29 Oktober 2026 09.00 WIB');
    });
});

describe('who in a notification', () => {
    it('adds the PIC unless the sentence already names the new one', () => {
        expect(withWho('Status: Selesai → Ditutup', picOf('Status: Selesai → Ditutup', 'Rizky Ardiansyah')))
            .toBe('Status: Selesai → Ditutup · PIC Rizky Ardiansyah');
        expect(withWho('PIC kini Rizky', picOf('PIC kini Rizky', 'Rizky'))).toBe('PIC kini Rizky');
        expect(withWho('Status: Baru → Dikerjakan', picOf('x', null))).toBe('Status: Baru → Dikerjakan');
    });
});
