/** Rules of the unified E-Form request form: what each kind needs, how long it may last, and the payload it sends. */
export type EformKind = 'VPN' | 'WEBSITE' | 'NETWORK' | 'FLASHDISK' | 'EMAIL' | 'SYNOLOGY_NAS';
export type NasServer = 'JKT' | 'KRW' | 'SMG' | 'SPJ';
export type NasRights = 'RO' | 'RW';
export interface NasFolder { srv: NasServer; path: string; rw: NasRights }

/** Access that may be permanent (no end date); every other kind must end within 12 months. */
export const PERMANENT_KINDS: readonly EformKind[] = ['WEBSITE', 'EMAIL', 'SYNOLOGY_NAS'];
export const MAX12_KINDS: readonly EformKind[] = ['VPN', 'NETWORK', 'FLASHDISK'];
const MAX_DAYS = 366;
const DAY_MS = 86_400_000;
const EMAIL_DOMAIN = '@kapalapi.co.id';

export interface EformForm {
    kind: EformKind;
    from: string;
    to: string;
    reason: string;
    dept: string;
    managerId: string;
    terms: boolean;
    signature: string | null;
    need: string;
    websites: string;
    net: string;
    host: string;
    usb: 'RO' | 'RW';
    fdInfo: string;
    email: string;
    emailType: 'PERSONAL' | 'SHARING';
    acct: 'NEW' | 'EXISTING';
    acctName: string;
    servers: NasServer[];
    folders: NasFolder[];
    shotUrls: string[];
}

export const emptyEform = (kind: EformKind, from: string): EformForm => ({
    kind, from, to: '', reason: '', dept: '', managerId: '', terms: false, signature: null, need: '', websites: '', net: '', host: '',
    usb: 'RO', fdInfo: '', email: '', emailType: 'PERSONAL', acct: 'NEW', acctName: '', servers: [], folders: [], shotUrls: [],
});

/** The part before the @: lowercase letters, digits, dot, dash and underscore only. */
export const emailLocalPart = (raw: string): string => raw.toLowerCase().replace(/[^a-z0-9._-]/g, '');

const dayNumber = (isoDay: string): number => Date.parse(`${isoDay}T00:00:00Z`) / DAY_MS;
export const durationDays = (from: string, to: string): number => Math.round(dayNumber(to) - dayNumber(from));

/** Quick ends of the period: [label, code]. Flashdisk may be a day or a week; some kinds may be permanent. */
export function periodPresets(kind: EformKind): Array<[string, string]> {
    const presets: Array<[string, string]> = [];
    if (kind === 'FLASHDISK') presets.push(['+1 hari', 'd1'], ['+1 minggu', 'd7']);
    presets.push(['+1 bln', 'm1'], ['+3 bln', 'm3'], ['+6 bln', 'm6']);
    presets.push(PERMANENT_KINDS.includes(kind) ? ['Permanen', 'perm'] : ['+12 bln', 'm12']);
    return presets;
}

/** The end date a preset gives from `from`; null for permanent. */
export function presetDates(from: string, code: string): string | null {
    if (code === 'perm') return null;
    const date = new Date(`${from}T00:00:00Z`);
    const amount = Number(code.slice(1));
    if (code.startsWith('d')) date.setUTCDate(date.getUTCDate() + amount);
    else date.setUTCMonth(date.getUTCMonth() + amount);
    return date.toISOString().slice(0, 10);
}

/** The first thing still missing or wrong, in the words the form shows; empty when it can be sent. */
export function efMissing(form: EformForm): string {
    const { kind } = form;
    if (kind === 'VPN' && !form.need) return 'Pilih kebutuhan VPN';
    if (kind === 'WEBSITE' && !form.websites.trim()) return 'Isi website yang diminta';
    if (kind === 'NETWORK' && !form.net.trim()) return 'Isi tujuan jaringan';
    if (kind === 'FLASHDISK' && !form.host.trim()) return 'Isi hostname PC';
    if (kind === 'EMAIL' && !form.email) return 'Isi usulan alamat email';
    if (kind === 'SYNOLOGY_NAS' && form.folders.length === 0 && form.shotUrls.length === 0) return 'Tambahkan minimal satu folder atau screenshot';
    if (kind === 'SYNOLOGY_NAS' && form.acct === 'EXISTING' && !form.acctName.trim()) return 'Isi nama akun Synology';
    if (!form.to && !PERMANENT_KINDS.includes(kind)) return 'Isi tanggal selesai';
    if (form.to && form.to < form.from) return 'Tanggal selesai sebelum mulai';
    if (form.to && MAX12_KINDS.includes(kind) && durationDays(form.from, form.to) > MAX_DAYS) return 'Maksimal 12 bulan';
    if (!form.reason.trim()) return 'Isi keperluan';
    if (!form.terms) return 'Setujui syarat penggunaan';
    if (!form.signature) return 'Tanda tangan dulu';
    return '';
}

/** Adds a folder unless it is empty or the same path is already asked on that server (any letter case). */
export function addNasFolder(folders: NasFolder[], next: NasFolder): { folders: NasFolder[] } | { error: string } {
    const path = next.path.trim();
    if (!path) return { error: 'Isi path folder' };
    if (folders.some((f) => f.srv === next.srv && f.path.toLowerCase() === path.toLowerCase())) return { error: 'Folder sudah ada' };
    return { folders: [...folders, { ...next, path }] };
}

const NEED_LABEL: Record<string, string> = { REMOTE: 'Remote PC Kantor', NETWORK: 'Akses Jaringan Kantor' };

/** The type-specific form data under the keys the document, the ticket card and IT's pages read. */
function typeData(form: EformForm): Record<string, unknown> {
    switch (form.kind) {
        case 'VPN': return { kebutuhanAkses: NEED_LABEL[form.need] ?? form.need };
        case 'FLASHDISK': return { hostname: form.host.trim(), accessLevel: form.usb === 'RW' ? 'READ_WRITE' : 'READ_ONLY', ...(form.fdInfo.trim() ? { flashdiskInfo: form.fdInfo.trim() } : {}) };
        case 'EMAIL': return { proposedEmail: form.email, emailDomain: EMAIL_DOMAIN, emailAddress: `${form.email}${EMAIL_DOMAIN}`, accountType: form.emailType };
        case 'SYNOLOGY_NAS': return {
            nasSelections: form.folders.map((f) => ({ nasId: f.srv, nasName: f.srv, folderPath: f.path, accessLevel: f.rw === 'RW' ? 'READ_WRITE' : 'READ_ONLY' })),
            ...(form.shotUrls.length ? { screenshots: form.shotUrls } : {}),
        };
        default: return {};
    }
}

/** The body of POST /request-flow/eform. */
export function toEformPayload(form: EformForm, requesterName: string): Record<string, unknown> {
    return {
        formType: form.kind,
        requesterName,
        requesterDepartment: form.dept,
        startDate: form.from,
        ...(form.to ? { endDate: form.to } : {}),
        formData: { alasan: form.reason.trim(), ...typeData(form) },
        ...(form.kind === 'WEBSITE' ? { requestedWebsites: form.websites.split(/\n|,/).map((x) => x.trim()).filter(Boolean).join(', ') } : {}),
        ...(form.kind === 'NETWORK' ? { networkPurpose: form.net.trim() } : {}),
        ...(form.kind === 'SYNOLOGY_NAS' ? {
            synologyAccountStatus: form.acct === 'EXISTING' ? 'EXISTING_ACCOUNT' : 'NEW_ACCOUNT',
            ...(form.acct === 'EXISTING' ? { synologyAccountName: form.acctName.trim() } : {}),
            selectedNasServers: form.servers,
        } : {}),
        termsAccepted: form.terms,
        ...(form.managerId ? { managerId: form.managerId } : {}),
        signatureData: form.signature,
    };
}
