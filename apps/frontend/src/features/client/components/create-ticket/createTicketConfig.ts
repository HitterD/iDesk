import type { NavigateFunction } from 'react-router-dom';
import {
    Box, Bug, Code2, Gauge, KeyRound, LayoutTemplate, Mail, PlugZap, Printer, RefreshCw, Rocket, Smartphone, Ticket,
    TriangleAlert, UserCog, WifiOff, Zap, BellOff, type LucideIcon,
} from 'lucide-react';

export type TicketType = 'none' | 'service' | 'oracle-request' | 'web-dev-request' | 'mobile-dev-request';
export type FormTicketType = Exclude<TicketType, 'none'>;

export const TICKET_TYPES = ['none', 'service', 'oracle-request', 'web-dev-request', 'mobile-dev-request'] as const satisfies readonly TicketType[];

export const PRIORITY_OPTIONS = [
    { id: 'LOW', label: 'Low (Minor/Cosmetic)', shortLabel: 'Low' },
    { id: 'MEDIUM', label: 'Normal (Moderate)', shortLabel: 'Normal' },
    { id: 'HIGH', label: 'Urgent (Major Impact)', shortLabel: 'Urgent' },
    { id: 'CRITICAL', label: 'Blocker (Critical)', shortLabel: 'Blocker' },
] as const;

export interface TicketTemplate {
    /** Selection key; defaults to the label (built-ins). Personal templates use `my:<id>`. */
    key?: string;
    label: string;
    priority: string;
    subject: string;
    description: string;
    category?: string;
    device?: string;
    software?: string;
}

export const templateKey = (template: TicketTemplate): string => template.key ?? template.label;

const ORACLE_TEMPLATES: readonly TicketTemplate[] = [
    { label: 'Login Issue', priority: 'MEDIUM', subject: 'Lupa Password / Gagal Login Oracle', description: 'Gagal login ke portal Oracle. Error message: ' },
    { label: 'Role Update', priority: 'MEDIUM', subject: 'Penambahan Role K2', description: 'Mohon tambahkan role [Nama Role] untuk user [Nama User] di K2.' },
    { label: 'System Error', priority: 'HIGH', subject: 'Error Transaksi Oracle', description: 'Terdapat error saat proses transaksi modul [Nama Modul]. Error detail: ' },
];

const WEB_DEV_TEMPLATES: readonly TicketTemplate[] = [
    { label: 'UI Bug', priority: 'HIGH', subject: 'Bug Tampilan / Antarmuka Web', description: 'Terdapat kendala tampilan pada halaman [Nama Halaman]. Detail isu: ' },
    { label: 'API Error', priority: 'HIGH', subject: 'Error Integrasi API / Backend', description: 'Gagal memuat data dari endpoint API [Nama Endpoint]. Pesan error: ' },
    { label: 'Fitur Baru', priority: 'MEDIUM', subject: 'Permintaan Fitur Baru Web', description: 'Kebutuhan fitur baru pada modul [Nama Modul]. Rincian kebutuhan: ' },
    { label: 'Slow Web', priority: 'MEDIUM', subject: 'Loading Website Lambat / Timeout', description: 'Akses ke web portal mengalami lag/timeout pada bagian [Bagian Web].' },
];

const MOBILE_DEV_TEMPLATES: readonly TicketTemplate[] = [
    { label: 'App Crash', priority: 'CRITICAL', subject: 'Aplikasi Mobile Force Close / Crash', description: 'Aplikasi mobile mengalami crash saat membuka [Menu/Fitur]. Perangkat & OS: ' },
    { label: 'Release Issue', priority: 'HIGH', subject: 'Kendala Rilis / Update APK', description: 'Gagal melakukan instalasi atau update APK versi [Nomor Versi].' },
    { label: 'Sync Error', priority: 'HIGH', subject: 'Gagal Sinkronisasi Data Mobile', description: 'Data pada aplikasi mobile tidak tersinkron ke server pada modul [Nama Modul].' },
    { label: 'Push Notif', priority: 'MEDIUM', subject: 'Push Notification Tidak Masuk', description: 'Notifikasi tidak muncul pada device pengguna saat trigger [Nama Event].' },
];

const CRITICAL_REASON_COPY = {
    criticalReasonLabel: 'Justifikasi Tiket Blocker (Critical)',
    criticalReasonPlaceholder: 'Jelaskan mengapa masalah ini menjadi pemblokir (blocker) / berdampak kritis bagi operasional...',
} as const;

const QUICK_TEMPLATES: readonly TicketTemplate[] = [
    { label: 'Email Issue', category: 'SOFTWARE', priority: 'HIGH', subject: 'Email tidak bisa diakses', description: 'Tidak dapat mengirim atau menerima email. Error message: ' },
    { label: 'Printer Fault', category: 'HARDWARE', priority: 'MEDIUM', subject: 'Printer rusak / tidak merespon', description: 'Printer tidak merespon saat print. Sudah direstart. Model printer: ' },
    { label: 'Slow System', category: 'HARDWARE', priority: 'LOW', subject: 'Komputer lemot', description: 'PC/Laptop sangat lambat saat membuka aplikasi. Area timbul keluhan: ' },
    { label: 'No Network', category: 'NETWORK', priority: 'HIGH', subject: 'Koneksi internet bermasalah', description: 'Tidak ada koneksi WiFi maupun LAN. Area/Lantai: ' },
    { label: 'Software Error', category: 'SOFTWARE', priority: 'CRITICAL', subject: 'Error sistem saat input data', description: 'Proses berhenti karena error. Nama sistem: ' },
    { label: 'Login Issue', category: 'GENERAL', priority: 'MEDIUM', subject: 'Password terkunci', description: 'Gagal login berkali-kali. Mohon dibantu reset. Username: ' },
];

/** Each quick template gets a glyph so the chips read as actions, not passive tags. */
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
    'Email Issue': Mail,
    'Printer Fault': Printer,
    'Slow System': Gauge,
    'No Network': WifiOff,
    'Software Error': TriangleAlert,
    'Login Issue': KeyRound,
    'Role Update': UserCog,
    'System Error': TriangleAlert,
    'UI Bug': Bug,
    'API Error': PlugZap,
    'Fitur Baru': Rocket,
    'Slow Web': Zap,
    'App Crash': Bug,
    'Release Issue': Rocket,
    'Sync Error': RefreshCw,
    'Push Notif': BellOff,
};

export const templateIcon = (template: TicketTemplate): LucideIcon => TEMPLATE_ICONS[template.label] ?? LayoutTemplate;

/** Built-in service categories, listed before the attribute-sourced ones (unchanged values). */
export const BASE_CATEGORY_OPTIONS = [
    { value: 'GENERAL', label: 'General' },
    { value: 'HARDWARE', label: 'Hardware' },
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'NETWORK', label: 'Network' },
] as const;

export type FormTone = 'blue' | 'red' | 'teal' | 'teal-deep';

export interface TicketFormConfig {
    title: string;
    subtitle: string;
    icon: typeof Ticket;
    tone: FormTone;
    templates: readonly TicketTemplate[];
    titleId: string;
    descriptionId: string;
    criticalReasonId: string;
    criticalReasonLabel: string;
    criticalReasonPlaceholder: string;
    titlePlaceholder: string;
    descriptionPlaceholder: string;
    submitLabel: string;
    loadingLabel: string;
    /** Only the service ticket carries category/device/software. */
    hasClassification: boolean;
}

/** Per-type presentation; payload mapping stays in the page's submit handler. */
export const TICKET_FORM_CONFIG: Record<FormTicketType, TicketFormConfig> = {
    service: {
        title: 'Service Ticket',
        subtitle: 'General IT Support Request (Hardware, Software, Network & General)',
        icon: Ticket,
        tone: 'blue',
        templates: QUICK_TEMPLATES,
        titleId: 'service-ticket-title',
        descriptionId: 'service-ticket-description',
        criticalReasonId: 'service-critical-reason',
        criticalReasonLabel: 'Justifikasi Blocker (Critical)',
        criticalReasonPlaceholder: 'Jelaskan alasan urgensi prioritas blocker (critical)...',
        titlePlaceholder: 'Ringkasan masalah (contoh: Monitor tidak menyala, Laptop lambat)...',
        descriptionPlaceholder: 'Jelaskan pesan error, lokasi, langkah yang sudah dicoba, atau paste screenshot langsung...',
        submitLabel: 'Kirim Service Ticket',
        loadingLabel: 'Membuat Tiket...',
        hasClassification: true,
    },
    'oracle-request': {
        title: 'Oracle / K2 Request',
        subtitle: 'Enterprise System Support (ERP, Database & K2 Workflow)',
        icon: Box,
        tone: 'red',
        templates: ORACLE_TEMPLATES,
        titleId: 'oracle-ticket-title',
        descriptionId: 'oracle-ticket-description',
        criticalReasonId: 'critical-reason',
        ...CRITICAL_REASON_COPY,
        titlePlaceholder: 'Contoh: Lupa Password Oracle, Penambahan Role K2, Error Validasi AP...',
        descriptionPlaceholder: 'Tuliskan secara lengkap pesan error, nama modul, username user, atau detail form K2 yang membutuhkan update...',
        submitLabel: 'Kirim Tiket Oracle',
        loadingLabel: 'Mengirim...',
        hasClassification: false,
    },
    'web-dev-request': {
        title: 'Web Developer Request',
        subtitle: 'Web Applications & Portal Development Support',
        icon: Code2,
        tone: 'teal',
        templates: WEB_DEV_TEMPLATES,
        titleId: 'web-dev-ticket-title',
        descriptionId: 'web-dev-ticket-description',
        criticalReasonId: 'critical-reason',
        ...CRITICAL_REASON_COPY,
        titlePlaceholder: 'Contoh: Bug Tombol Submit, Error API Endpoint, Permintaan Halaman Baru...',
        descriptionPlaceholder: 'Jelaskan URL/halaman web, langkah reproduksi error, console log jika ada, atau spesifikasi fitur yang diinginkan...',
        submitLabel: 'Kirim Tiket Web Dev',
        loadingLabel: 'Mengirim...',
        hasClassification: false,
    },
    'mobile-dev-request': {
        title: 'Mobile Developer Request',
        subtitle: 'Mobile iOS & Android App Development Support',
        icon: Smartphone,
        tone: 'teal-deep',
        templates: MOBILE_DEV_TEMPLATES,
        titleId: 'mobile-dev-ticket-title',
        descriptionId: 'mobile-dev-ticket-description',
        criticalReasonId: 'critical-reason',
        ...CRITICAL_REASON_COPY,
        titlePlaceholder: 'Contoh: App Force Close, Gagal Download APK, Push Notif Error...',
        descriptionPlaceholder: 'Jelaskan tipe perangkat (Android/iOS), versi OS, langkah terjadinya error, atau lampirkan screenshot log crash...',
        submitLabel: 'Kirim Tiket Mobile Dev',
        loadingLabel: 'Mengirim...',
        hasClassification: false,
    },
};

export interface TicketTypeCardActionArgs {
    setTicketType: (type: TicketType) => void;
    navigate: NavigateFunction;
    getBasePath: () => string;
}

export interface TicketCardConfig {
    key: string;
    pageKey?: string;
    section: 'ticketing' | 'request';
    /** Not displayed; kept as catalogue search keywords. */
    eyebrow: string;
    title: string;
    description: string;
    mascotImg: string;
    mascotAlt: string;
    ctaLabel: string;
    action: (args: TicketTypeCardActionArgs) => void;
}

export const TICKETING_CARDS: readonly TicketCardConfig[] = [
    {
        key: 'service',
        pageKey: 'tickets',
        section: 'ticketing',
        eyebrow: 'General Support',
        title: 'Service Ticket',
        description: 'Laporkan masalah hardware, software, jaringan, atau kebutuhan IT support umum lainnya.',
        mascotImg: '/characters/mascot-service.png',
        mascotAlt: 'Maskot IT Support Agent',
        ctaLabel: 'Buat Service Ticket',
        action: ({ setTicketType }) => setTicketType('service'),
    },
    {
        key: 'oracle-request',
        section: 'ticketing',
        eyebrow: 'Enterprise System',
        title: 'Oracle / K2 Request',
        description: 'Bantuan sistem Oracle, update role K2, transaksi modul, atau kendala ERP.',
        mascotImg: '/characters/mascot-oracle.png',
        mascotAlt: 'Maskot Oracle & K2',
        ctaLabel: 'Buat Tiket Oracle',
        action: ({ setTicketType }) => setTicketType('oracle-request'),
    },
    {
        key: 'web-dev-request',
        section: 'ticketing',
        eyebrow: 'Web System',
        title: 'Web Developer Request',
        description: 'Permintaan bug fix, fitur baru, integrasi web portal, atau kendala performa web.',
        mascotImg: '/characters/mascot-webdev.png',
        mascotAlt: 'Maskot Web Developer',
        ctaLabel: 'Buat Tiket Web Dev',
        action: ({ setTicketType }) => setTicketType('web-dev-request'),
    },
    {
        key: 'mobile-dev-request',
        section: 'ticketing',
        eyebrow: 'Mobile App',
        title: 'Mobile Developer Request',
        description: 'Permintaan perbaikan crash aplikasi, update APK, notifikasi, atau fitur app mobile.',
        mascotImg: '/characters/mascot-mobiledev.png',
        mascotAlt: 'Maskot Mobile Developer',
        ctaLabel: 'Buat Tiket Mobile Dev',
        action: ({ setTicketType }) => setTicketType('mobile-dev-request'),
    },
];

export const REQUEST_CARDS: readonly TicketCardConfig[] = [
    {
        key: 'hardware-budget',
        pageKey: 'hardware_requests',
        section: 'request',
        eyebrow: 'Procurement',
        title: 'Hardware & Budget',
        description: 'Ajukan pembelian perangkat keras baru, upgrade spesifikasi laptop/PC, atau penggantian aset.',
        mascotImg: '/characters/mascot-hardware.png',
        mascotAlt: 'Maskot Pengadaan Hardware',
        ctaLabel: 'Buka Form Pengadaan',
        action: ({ navigate, getBasePath }) => navigate(`${getBasePath()}/hardware-requests`),
    },
    {
        key: 'access-request',
        pageKey: 'eform_access',
        section: 'request',
        eyebrow: 'Network & Access',
        title: 'Access Request',
        description: 'Minta akses WiFi, koneksi VPN, atau izin akses website/aplikasi dengan form approval resmi.',
        mascotImg: '/characters/mascot-access.png',
        mascotAlt: 'Maskot Izin Akses',
        ctaLabel: 'Ajukan Form Akses',
        action: ({ navigate, getBasePath }) => navigate(`${getBasePath()}/eform-access/new`),
    },
];

/** Case-insensitive match on the card's visible copy plus its legacy eyebrow keyword. */
export function matchesCatalogQuery(card: TicketCardConfig, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${card.title} ${card.description} ${card.eyebrow} ${card.ctaLabel}`.toLowerCase().includes(needle);
}
