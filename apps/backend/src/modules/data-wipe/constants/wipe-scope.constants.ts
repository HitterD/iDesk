/**
 * Wipe scope definition — the single source of truth for what a data wipe touches.
 *
 * The design is allowlist-only: a table that is not listed here is never deleted
 * from, so tables added to the schema later are safe by default. FORBIDDEN_TABLES
 * exists purely as a tripwire — if a name ever appears in both lists, the module
 * refuses to load rather than deleting something it should not.
 *
 * Delete order matters and is not alphabetical. It is dictated by foreign keys
 * that either RESTRICT or have no ON DELETE action at all:
 *   - hardware_assets.item_id -> hardware_request_items ON DELETE RESTRICT
 *   - access_requests.ticketId / lost_item_reports.ticketId -> tickets, NO ACTION
 *   - ticket_messages.ticketId / ticket_surveys.ticketId -> tickets, NO ACTION
 * Reordering these entries will make the wipe transaction abort.
 */

export enum WipeDomain {
    TICKETING = 'TICKETING',
    EFORM = 'EFORM',
    HARDWARE = 'HARDWARE',
}

/** Human-readable domain labels for the preview screen (Indonesian UI). */
export const WIPE_DOMAIN_LABELS: Record<WipeDomain, string> = {
    [WipeDomain.TICKETING]: 'Tiketing',
    [WipeDomain.EFORM]: 'E-Form',
    [WipeDomain.HARDWARE]: 'Hardware Request',
};

export interface WipeTableSpec {
    /** Physical table name. */
    table: string;
    /** Label shown in the preview table. */
    label: string;
    /**
     * Raw SQL WHERE clause (without the `WHERE` keyword) restricting the delete.
     * Used for shared tables that hold rows belonging to other domains too.
     * Omit to delete every row in the table.
     */
    where?: string;
    /**
     * True when the row belongs to a domain outside the three the user named.
     * These are surfaced separately in the preview so the operator can see
     * exactly what is being removed beyond ticketing / e-form / hardware.
     */
    outOfScope?: boolean;
    /**
     * Why an out-of-scope table has to be included. Rendered in the preview.
     */
    reason?: string;
}

/**
 * Shared tables cleaned once per wipe, regardless of which domains are selected.
 * Filters are built per selected domain at runtime; see buildSharedTableSpecs.
 */
const NOTIFICATION_CATEGORY_BY_DOMAIN: Record<WipeDomain, string[]> = {
    [WipeDomain.TICKETING]: ['CATEGORY_TICKET'],
    [WipeDomain.EFORM]: ['CATEGORY_EFORM'],
    [WipeDomain.HARDWARE]: ['CATEGORY_HARDWARE'],
};

const SNOOZE_ENTITY_TYPE_BY_DOMAIN: Record<WipeDomain, string[]> = {
    [WipeDomain.TICKETING]: ['TICKET'],
    [WipeDomain.EFORM]: [],
    [WipeDomain.HARDWARE]: ['HARDWARE_REQUEST'],
};

/** SQL-quotes a list of literals for an IN (...) clause. */
function sqlInList(values: string[]): string {
    return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

/**
 * Shared / cross-domain tables, deleted before the domain tables themselves.
 * None of these have a foreign key into the three domains, so nothing cascades
 * here — every row has to be matched explicitly by category or entity type.
 */
export function buildSharedTableSpecs(domains: WipeDomain[]): WipeTableSpec[] {
    const specs: WipeTableSpec[] = [];

    const categories = domains.flatMap((d) => NOTIFICATION_CATEGORY_BY_DOMAIN[d]);
    if (categories.length > 0) {
        specs.push({
            table: 'notifications',
            label: 'Notifikasi',
            where: `category IN (${sqlInList(categories)})`,
            outOfScope: true,
            reason: 'Menunjuk data yang dihapus tanpa foreign key — tautannya akan mati',
        });
    }

    const snoozeTypes = domains.flatMap((d) => SNOOZE_ENTITY_TYPE_BY_DOMAIN[d]);
    if (snoozeTypes.length > 0) {
        specs.push({
            table: 'action_item_snooze',
            label: 'Tunda Action Item',
            where: `"entityType" IN (${sqlInList(snoozeTypes)})`,
            outOfScope: true,
            reason: 'Referensi polimorfik ke data yang dihapus',
        });
    }

    if (domains.includes(WipeDomain.TICKETING)) {
        specs.push({
            table: 'workflow_executions',
            label: 'Riwayat Eksekusi Otomasi',
            outOfScope: true,
            reason: 'Menyimpan ticketId tanpa foreign key',
        });
        specs.push({
            table: 'agent_daily_workload',
            label: 'Beban Kerja Harian Agent',
            outOfScope: true,
            reason: 'Angka turunan dari tiket — akan menampilkan hitungan palsu',
        });
    }

    return specs;
}

/**
 * Per-domain tables in mandatory delete order (children first).
 */
export const DOMAIN_TABLE_SPECS: Record<WipeDomain, WipeTableSpec[]> = {
    [WipeDomain.HARDWARE]: [
        {
            table: 'hardware_assets',
            label: 'Aset Hardware Terpasang',
            reason: 'FK RESTRICT — wajib dihapus sebelum item request',
        },
        { table: 'installation_schedule_items', label: 'Item Jadwal Instalasi' },
        { table: 'installation_schedules', label: 'Jadwal Instalasi' },
        { table: 'hardware_request_comments', label: 'Komentar Hardware Request' },
        { table: 'hardware_request_activities', label: 'Aktivitas Hardware Request' },
        { table: 'hardware_request_items', label: 'Item Hardware Request' },
        { table: 'hardware_requests', label: 'Hardware Request' },
    ],
    [WipeDomain.EFORM]: [
        { table: 'eform_credentials', label: 'Kredensial E-Form (terenkripsi)' },
        { table: 'eform_signatures', label: 'Tanda Tangan E-Form' },
        { table: 'eform_approvals', label: 'Persetujuan E-Form' },
        { table: 'eform_requests', label: 'Pengajuan E-Form' },
    ],
    [WipeDomain.TICKETING]: [
        {
            table: 'access_requests',
            label: 'Permintaan Akses',
            outOfScope: true,
            reason: 'FK ke tickets tanpa ON DELETE — memblokir penghapusan tiket',
        },
        {
            table: 'lost_item_reports',
            label: 'Laporan Kehilangan Barang',
            outOfScope: true,
            reason: 'FK ke tickets tanpa ON DELETE — memblokir penghapusan tiket',
        },
        { table: 'time_entries', label: 'Catatan Waktu Kerja' },
        { table: 'ticket_reminders', label: 'Pengingat Tiket' },
        { table: 'sla_adjustments', label: 'Penyesuaian SLA' },
        { table: 'ticket_participants', label: 'Partisipan Tiket' },
        { table: 'ticket_surveys', label: 'Survei Kepuasan' },
        { table: 'ticket_messages', label: 'Pesan & Diskusi Tiket' },
        { table: 'tickets', label: 'Tiket' },
    ],
};

/**
 * Transactional counters living on config rows. The config row itself survives;
 * only the number is reset, so "start from zero" holds without losing templates.
 */
export const COUNTER_RESETS: { table: string; column: string; label: string }[] = [
    { table: 'ticket_templates', column: 'usageCount', label: 'Hitungan pemakaian template tiket' },
    { table: 'saved_searches', column: 'useCount', label: 'Hitungan pemakaian pencarian tersimpan' },
];

/**
 * Upload sub-directories safe to remove wholesale, because every file inside is
 * partitioned by the id of a record being deleted. Flat upload directories are
 * deliberately excluded — reclaiming those needs a disk-vs-database diff, which
 * StorageCleanupService already implements.
 */
export const WIPE_UPLOAD_DIRS: Record<WipeDomain, string[]> = {
    [WipeDomain.TICKETING]: ['tickets', 'access-forms'],
    // Flat, but every file in it is a GM-signed copy of an e-form request, all of which a wipe deletes.
    [WipeDomain.EFORM]: ['eform-approvals'],
    [WipeDomain.HARDWARE]: [],
};

/**
 * Tables that must never be touched. This is a tripwire, not the enforcement
 * mechanism — enforcement is the allowlist above. assertWipeScopeIntegrity()
 * fails fast at module load if the two ever overlap.
 */
export const FORBIDDEN_TABLES: readonly string[] = [
    'users',
    'audit_logs',
    'backup_configurations',
    'backup_history',
    'system_settings',
    'sites',
    'departments',
    'feature_definitions',
    'permission_presets',
    'user_feature_permissions',
    'ticket_attributes',
    'ticket_modules',
    'ticket_templates',
    'saved_replies',
    'sla_configs',
    'business_hours',
    'priority_weights',
    'hardware_catalog',
    'access_types',
    'workflow_rules',
    'notification_preferences',
    'notification_sounds',
    'zoom_accounts',
    'zoom_bookings',
] as const;

/** Every table the wipe may delete rows from, across all domains. */
export function allWipableTables(): string[] {
    const domainTables = Object.values(DOMAIN_TABLE_SPECS).flatMap((specs) =>
        specs.map((s) => s.table),
    );
    const sharedTables = buildSharedTableSpecs(Object.values(WipeDomain)).map((s) => s.table);
    return [...new Set([...sharedTables, ...domainTables])];
}

/**
 * Guards the allowlist against the forbidden list. Called at module construction
 * so a bad edit fails the application boot rather than a production wipe.
 */
export function assertWipeScopeIntegrity(): void {
    const overlap = allWipableTables().filter((t) => FORBIDDEN_TABLES.includes(t));
    if (overlap.length > 0) {
        throw new Error(
            `Wipe scope integrity violation: protected table(s) present in wipe allowlist: ${overlap.join(', ')}`,
        );
    }

    const counterOverlap = COUNTER_RESETS.filter((c) => allWipableTables().includes(c.table));
    if (counterOverlap.length > 0) {
        throw new Error(
            `Wipe scope integrity violation: counter-reset table(s) are also being deleted: ${counterOverlap
                .map((c) => c.table)
                .join(', ')}`,
        );
    }
}

/**
 * Builds the complete ordered delete plan for the selected domains.
 * Shared tables first (they only reference the domains, nothing references them),
 * then each domain's own tables children-first.
 */
export function buildWipePlan(domains: WipeDomain[]): WipeTableSpec[] {
    const ordered = [
        ...buildSharedTableSpecs(domains),
        // Hardware before ticketing: installation_schedules points at tickets.
        ...(domains.includes(WipeDomain.HARDWARE) ? DOMAIN_TABLE_SPECS[WipeDomain.HARDWARE] : []),
        ...(domains.includes(WipeDomain.EFORM) ? DOMAIN_TABLE_SPECS[WipeDomain.EFORM] : []),
        ...(domains.includes(WipeDomain.TICKETING) ? DOMAIN_TABLE_SPECS[WipeDomain.TICKETING] : []),
    ];

    const forbidden = ordered.filter((s) => FORBIDDEN_TABLES.includes(s.table));
    if (forbidden.length > 0) {
        throw new Error(
            `Refusing to build wipe plan touching protected table(s): ${forbidden
                .map((s) => s.table)
                .join(', ')}`,
        );
    }

    return ordered;
}
