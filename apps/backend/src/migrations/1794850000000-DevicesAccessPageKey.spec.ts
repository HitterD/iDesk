import { DevicesAccessPageKey1794850000000, MIGRATE_PRESETS_SQL, STRIP_USER_PRESETS_SQL } from './1794850000000-DevicesAccessPageKey';

describe('DevicesAccessPageKey1794850000000', () => {
    it('runs the staff presets before the requester presets, each as plain data statements', async () => {
        const query = jest.fn(async (_sql: string) => undefined);
        await new DevicesAccessPageKey1794850000000().up({ query } as never);
        expect(query.mock.calls.map(([sql]) => sql)).toEqual([MIGRATE_PRESETS_SQL, STRIP_USER_PRESETS_SQL]);
    });

    it('a preset that gave Hardware Requests or E-Form Access (true) now gives Perangkat & Akses, for non-USER presets only', () => {
        expect(MIGRATE_PRESETS_SQL).toContain(`"pageAccess" = ("pageAccess" - 'hardware_requests' - 'eform_access') || '{"devices_access": true}'::jsonb`);
        expect(MIGRATE_PRESETS_SQL).toContain(`"targetRole" <> 'USER'`);
        expect(MIGRATE_PRESETS_SQL).toContain(`("pageAccess"->>'hardware_requests') = 'true'`);
        expect(MIGRATE_PRESETS_SQL).toContain(`("pageAccess"->>'eform_access') = 'true'`);
    });

    it('whatever still holds the old keys afterwards (requester presets, staff presets that had both off) just loses them and gets nothing', () => {
        expect(STRIP_USER_PRESETS_SQL).toContain(`"pageAccess" - 'hardware_requests' - 'eform_access'`);
        expect(STRIP_USER_PRESETS_SQL).not.toContain('devices_access');
        expect(STRIP_USER_PRESETS_SQL).not.toContain('"role"');
    });

    it('never touches an enum or a table shape (it runs inside the shared migration transaction)', () => {
        for (const sql of [MIGRATE_PRESETS_SQL, STRIP_USER_PRESETS_SQL]) expect(sql).not.toMatch(/ALTER\s+(TYPE|TABLE)/i);
    });

    it('is idempotent: running it again changes nothing', () => {
        expect(MIGRATE_PRESETS_SQL).toContain(`"pageAccess" ?| ARRAY['hardware_requests', 'eform_access']`);
        expect(STRIP_USER_PRESETS_SQL).toContain(`"pageAccess" ?| ARRAY['hardware_requests', 'eform_access']`);
    });
});
