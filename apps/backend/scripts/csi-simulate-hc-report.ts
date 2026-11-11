/**
 * Simulated CSI HC report from the SMG + SPJ assignment templates, for judging the report PDF/Excel with realistic data.
 *
 *   npx ts-node scripts/csi-simulate-hc-report.ts
 *
 * Only runs against the local demo database (DB_DATABASE=idesk_csi_demo). It replaces any earlier simulation (HC
 * surveys whose title starts with CSI_SIMULATION_TITLE_PREFIX are cancelled and purged), then goes through the same
 * services as the app: survey from templates (draft) → publish → each answering rater submits the respondent form →
 * report PDF and Excel via CsiExportService. Answers are fictitious and deterministic (fixed PRNG seed).
 *
 * Dates: published HC surveys of SMG/SPJ already cover today, and publishing refuses a clash; the simulation therefore
 * runs in an earlier free window (SIM_START..SIM_END) with no earlier published HC survey (no "previous period"), and
 * every submit passes a `now` inside that window. Never commit the PDF/XLSX.
 */
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { readdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ServiceScope } from '../src/shared/core/utils/service-scope.util';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditLog } from '../src/modules/audit/entities/audit-log.entity';
import { SystemSettings } from '../src/modules/settings/entities/system-settings.entity';
import { Site } from '../src/modules/sites/entities/site.entity';
import { Ticket } from '../src/modules/ticketing/entities/ticket.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { ReportSignoffService } from '../src/modules/reports/services/report-signoff.service';
import {
    CSI_SCORE_FAIR_MIN_DEFAULT, CSI_SCORE_GOOD_MIN_DEFAULT, CSI_SIMULATION_TITLE_PREFIX, CSI_SLA_TARGET_DEFAULT_HC, CsiPeriodPublishStatus,
} from '../src/modules/csi/csi.constants';
import { CsiOrgService } from '../src/modules/csi/org/csi-org.service';
import { CsiAssignmentTemplateService } from '../src/modules/csi/services/csi-assignment-template.service';
import { CsiAssignmentService, CsiAssignmentView } from '../src/modules/csi/services/csi-assignment.service';
import { CsiExportService } from '../src/modules/csi/services/csi-export.service';
import { CsiPeriodService } from '../src/modules/csi/services/csi-period.service';
import { CsiReportService } from '../src/modules/csi/services/csi-report.service';
import { CsiRespondentService } from '../src/modules/csi/services/csi-respondent.service';
import { CsiSlaService } from '../src/modules/csi/services/csi-sla.service';
import { CsiSubjectService } from '../src/modules/csi/services/csi-subject.service';
import { CsiTemplateApplyService } from '../src/modules/csi/services/csi-template-apply.service';

const DEMO_DATABASE = 'idesk_csi_demo';
const HC = ServiceScope.HC;
const LOCATIONS = ['SMG', 'SPJ'];
const TITLE = `${CSI_SIMULATION_TITLE_PREFIX}CSI HC 2026 (SMG + SPJ)`;
const SIM_START = '2026-10-01';
const SIM_END = '2026-10-16';
const SIM_DAYS = 16;
const SEED = 20261110;
const ANSWER_SHARE = 0.85;
const FEW_RATERS = 3;
const LOW_PIC_COUNT = 2;
/** Low-scored and tied PICs are picked among those with enough pairs to stay ranked. */
const SKEW_MIN_PAIRS = 10;
const LOW_MEAN = 3.8;
const MEAN_MIN = 4.2;
const MEAN_SPREAD = 0.45;
const SCORE_NOISE = 0.55;
const SCORE_FLOOR = 3;
const SCORE_MAX = 5;
const WORK_HOUR_FIRST = 8;
const WORK_HOURS = 9;
const WIB_OFFSET = '+07:00';
const PURGE_REASON = 'Simulasi diganti oleh skrip simulasi baru';
const DOWNLOADS = join(homedir(), 'Downloads');
const PDF_PATH = join(DOWNLOADS, 'CSI HC 2026 - SIMULASI report.pdf');
const XLSX_PATH = join(DOWNLOADS, 'CSI HC 2026 - SIMULASI report.xlsx');

const PRAISE = [
    'Pelayanan cepat dan jelas, terima kasih.', 'Sangat membantu saat ada kendala administrasi.', 'Responsif walaupun di luar jam kerja.',
    'Penjelasannya mudah dipahami.', 'Ramah dan sabar menjawab pertanyaan.', 'Informasi selalu disampaikan tepat waktu.',
    'Proses pengajuan jadi lebih mudah.', 'Komunikasi baik, tindak lanjut jelas.', 'Pelayanan konsisten dari awal sampai selesai.',
    'Solusi yang diberikan tepat sasaran.', 'Cepat menanggapi keluhan karyawan.', 'Sangat profesional dalam melayani.',
    'Membantu sekali untuk karyawan baru.', 'Data yang diberikan akurat.', 'Terima kasih atas bantuannya selama ini.',
    'Mudah dihubungi lewat chat maupun telepon.', 'Penjelasan aturan sangat jelas.', 'Pelayanan di lapangan juga baik.',
    'Selalu memberi kabar perkembangan.', 'Pertahankan kinerjanya.',
];
const IMPROVE = [
    'Mohon respon pesan bisa lebih cepat.', 'Informasi perubahan aturan sebaiknya disosialisasikan lebih awal.',
    'Kadang sulit dihubungi saat jam istirahat.', 'Proses pengajuan masih terasa lama.', 'Perlu penjelasan yang lebih rinci untuk prosedur baru.',
    'Tindak lanjut keluhan perlu dipercepat.', 'Jadwal layanan sebaiknya diumumkan lebih jelas.', 'Mohon lebih konsisten dalam memberi kabar.',
    'Dokumen kadang perlu direvisi berulang kali.', 'Antrean layanan di jam sibuk cukup panjang.',
];

/** Every CSI entity class: the repositories the CSI services inject. */
const CSI_ENTITY_DIR = join(__dirname, '..', 'src', 'modules', 'csi', 'entities');
const csiEntities = readdirSync(CSI_ENTITY_DIR).filter((file) => /\.entity\.(ts|js)$/.test(file))
    .flatMap((file) => Object.values(require(join(CSI_ENTITY_DIR, file)) as Record<string, unknown>))
    .filter((value): value is Function => typeof value === 'function');

/** Only the providers the simulation needs (no HTTP, no cron, no Redis): the same service classes the app uses. */
@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432),
            username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
            entities: [join(__dirname, '..', 'src', '**', '*.entity.{ts,js}')], synchronize: false, logging: ['error'],
        }),
        TypeOrmModule.forFeature([...csiEntities, AuditLog, SystemSettings, Site, Ticket, User]),
    ],
    providers: [
        AuditService, ReportSignoffService, CsiOrgService, CsiSubjectService, CsiAssignmentService, CsiAssignmentTemplateService,
        CsiPeriodService, CsiTemplateApplyService, CsiRespondentService, CsiSlaService, CsiReportService, CsiExportService,
    ],
})
class SimulationModule { }

/** mulberry32: small seeded PRNG, so reruns produce the same answers. */
function seededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
type Rng = () => number;
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const pick = <T>(rng: Rng, items: readonly T[]) => items[Math.floor(rng() * items.length)];
function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(rng() * (index + 1));
        [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
}
const clampScore = (value: number) => Math.min(SCORE_MAX, Math.max(SCORE_FLOOR, Math.round(value)));

type Services = {
    db: DataSource; templates: CsiAssignmentTemplateService; applier: CsiTemplateApplyService; periods: CsiPeriodService;
    assignments: CsiAssignmentService; respondent: CsiRespondentService; exporter: CsiExportService;
};
type Plan = {
    answering: Set<string>; fewRatee: string; lowRatees: Set<string>; tie: [string, string] | null;
    means: Map<string, number>; nameOf: Map<string, string>;
};

async function adminId(db: DataSource): Promise<string> {
    const [row] = await db.query(`SELECT id FROM users WHERE role = 'HC_ADMIN' AND "isActive" ORDER BY "createdAt" LIMIT 1`);
    if (!row) throw new Error('Tidak ada akun HC_ADMIN aktif untuk menjadi pembuat survei simulasi');
    return row.id;
}

/** Cancels and purges earlier simulations (only titles with the simulation prefix), the app's two-step delete. */
async function removeOldSimulations(s: Services, actorId: string) {
    const rows: Array<{ id: string; title: string }> = await s.db.query(
        `SELECT id, title FROM csi_periods WHERE scope = $1 AND title LIKE $2`, [HC, `${CSI_SIMULATION_TITLE_PREFIX}%`]);
    for (const row of rows) {
        if (!row.title.startsWith(CSI_SIMULATION_TITLE_PREFIX)) continue;
        const confirm = { confirmTitle: row.title, reason: PURGE_REASON };
        await s.periods.cancel(HC, row.id, confirm, actorId);
        await s.periods.purge(HC, row.id, confirm);
        console.log(`Simulasi lama dihapus: ${row.id}`);
    }
}

async function createSimulation(s: Services, actorId: string) {
    const { templates } = await s.templates.list(HC);
    const ids = LOCATIONS.map((code) => {
        const template = templates.find((row) => row.locationCode === code);
        if (!template) throw new Error(`Template HC ${code} tidak ditemukan`);
        return template.id;
    });
    const { periodId, report } = await s.applier.createPeriodFromTemplates(HC, ids, { title: TITLE, startDate: SIM_START, endDate: SIM_END }, actorId);
    await s.periods.update(HC, periodId, {
        slaTargetPct: CSI_SLA_TARGET_DEFAULT_HC, scoreFairMin: CSI_SCORE_FAIR_MIN_DEFAULT, scoreGoodMin: CSI_SCORE_GOOD_MIN_DEFAULT,
    });
    await s.periods.publish(HC, periodId);
    console.log(`Survei ${periodId}: PIC ${report.picsAdded}, tim ${report.teamsAdded}, penilai ${report.ratersAdded}, pasangan ${report.pairsAdded}`);
    console.log(`  di luar site survei: ${report.ratersOutsideSites.length}, PIC tanpa penilai: ${report.picsSkippedNoRaters.length}`);
    return periodId;
}

/** Raters of the period sites (they see the survey), grouped by ratee. */
function pairsByRatee(view: CsiAssignmentView, siteIds: Set<string>) {
    const eligible = new Map(view.raters.filter((rater) => rater.siteId && siteIds.has(rater.siteId)).map((rater) => [rater.periodRaterId, rater.userId]));
    const byRatee = new Map<string, string[]>();
    view.pairs.forEach((pair) => {
        const userId = eligible.get(pair.periodRaterId);
        if (userId) byRatee.set(pair.periodRateeId, [...(byRatee.get(pair.periodRateeId) ?? []), userId]);
    });
    // Sorted by user id: period row ids are new on every run, user ids are not (keeps reruns deterministic).
    byRatee.forEach((userIds) => userIds.sort());
    return { eligible: [...new Set(eligible.values())].sort(), byRatee };
}

/** Who answers (≈85%), the PIC with only FEW_RATERS answering raters, the two low PICs, a forced tie and every mean. */
function planAnswers(rng: Rng, view: CsiAssignmentView, siteIds: Set<string>, serviceOf: Map<string, string | null>): Plan {
    const { eligible, byRatee } = pairsByRatee(view, siteIds);
    const nameOf = new Map(view.ratees.map((ratee) => [ratee.periodRateeId, ratee.name]));
    const byName = (a: string, b: string) => nameOf.get(a)!.localeCompare(nameOf.get(b)!);
    const ratees = [...byRatee.keys()].sort(byName);
    const fewRatee = ratees.filter((id) => byRatee.get(id)!.length > FEW_RATERS)
        .sort((a, b) => byRatee.get(a)!.length - byRatee.get(b)!.length || byName(a, b))[0];
    const fewRaters = byRatee.get(fewRatee)!;
    const keep = new Set(shuffled(rng, fewRaters).slice(0, FEW_RATERS));
    const silent = new Set(fewRaters.filter((userId) => !keep.has(userId)));
    const pool = shuffled(rng, eligible.filter((userId) => !silent.has(userId) && !keep.has(userId)));
    const answering = new Set([...keep, ...pool.slice(0, Math.round(eligible.length * ANSWER_SHARE) - keep.size)]);
    const ranked = shuffled(rng, ratees.filter((id) => id !== fewRatee && byRatee.get(id)!.length >= SKEW_MIN_PAIRS));
    const lowRatees = new Set(ranked.slice(0, LOW_PIC_COUNT));
    const means = new Map(ratees.map((id) => [id, lowRatees.has(id) ? LOW_MEAN : MEAN_MIN + rng() * MEAN_SPREAD]));
    const rest = ranked.slice(LOW_PIC_COUNT);
    const partner = (id: string) => rest.find((other) => other !== id && serviceOf.get(other) === serviceOf.get(id));
    const first = rest.find((id) => partner(id));
    return { answering, fewRatee, lowRatees, tie: first ? [first, partner(first)!] : null, means, nameOf };
}

type FormRatee = { periodRateeId: string; dimensions: Array<{ periodRateeDimensionId: string }> };
type Draft = { userId: string; departmentId: string; now: Date; scores: Map<string, number[]>; comments: Map<string, string> };

function submitMoment(rng: Rng): Date {
    const day = Math.floor(rng() * SIM_DAYS);
    const date = new Date(`${SIM_START}T00:00:00${WIB_OFFSET}`);
    date.setUTCDate(date.getUTCDate() + day);
    date.setUTCHours(date.getUTCHours() + WORK_HOUR_FIRST + Math.floor(rng() * WORK_HOURS), Math.floor(rng() * 60));
    return date;
}

/** Reads each answering rater's form (the respondent flow) and draws the scores; raters without a visible form are skipped. */
async function draftAnswers(s: Services, rng: Rng, periodId: string, plan: Plan): Promise<Draft[]> {
    const drafts: Draft[] = [];
    for (const userId of [...plan.answering].sort()) {
        const now = submitMoment(rng);
        const form = await s.respondent.getForm({ id: userId }, periodId, now).catch((error: Error) => {
            console.warn(`Penilai ${userId} dilewati: ${error.message}`);
            return null;
        });
        if (!form) continue;
        const departmentId = form.respondent.departmentId ?? pick(rng, form.departments).id;
        const scores = new Map((form.ratees as FormRatee[]).map((ratee) => {
            const mean = plan.means.get(ratee.periodRateeId) ?? MEAN_MIN;
            return [ratee.periodRateeId, ratee.dimensions.map(() => clampScore(mean + gauss(rng) * SCORE_NOISE))] as const;
        }));
        drafts.push({ userId, departmentId, now, scores, comments: new Map() });
    }
    return drafts;
}

/** Mean over raters of each rater's own average for one ratee (how the report averages). */
function rateeAverage(drafts: Draft[], rateeId: string): number | null {
    const own = drafts.map((draft) => draft.scores.get(rateeId)).filter((row): row is number[] => !!row?.length);
    if (!own.length) return null;
    return own.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0) / row.length, 0) / own.length;
}
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Nudges single scores of the second PIC until both print the same 2-decimal average (a visible tie in the ranking). */
function forceTie(rng: Rng, drafts: Draft[], [target, moved]: [string, string]): boolean {
    const goal = rateeAverage(drafts, target);
    const rows = drafts.map((draft) => draft.scores.get(moved)).filter((row): row is number[] => !!row?.length);
    for (let step = 0; goal !== null && rows.length && step < 5000; step += 1) {
        const current = rateeAverage(drafts, moved)!;
        if (round2(current) === round2(goal)) return true;
        const row = pick(rng, rows);
        const index = Math.floor(rng() * row.length);
        const next = row[index] + (current < goal ? 1 : -1);
        if (next >= SCORE_FLOOR && next <= SCORE_MAX) row[index] = next;
    }
    return false;
}

/** ~30 short generic comments (no names), improvement remarks for the low PICs. */
function addComments(rng: Rng, drafts: Draft[], plan: Plan) {
    const slots = shuffled(rng, drafts.flatMap((draft) => [...draft.scores.keys()].map((rateeId) => ({ draft, rateeId }))));
    const texts = [...PRAISE, ...IMPROVE];
    slots.slice(0, texts.length).forEach(({ draft, rateeId }, index) => {
        const low = plan.lowRatees.has(rateeId);
        draft.comments.set(rateeId, low ? IMPROVE[index % IMPROVE.length] : texts[index]);
    });
}

async function submitAll(s: Services, periodId: string, drafts: Draft[]) {
    for (const draft of drafts) {
        const items = [...draft.scores.entries()].flatMap(([rateeId, scores]) => scores.map((score, index) => ({ rateeId, index, score })));
        const form = await s.respondent.getForm({ id: draft.userId }, periodId, draft.now);
        const dimensionIds = new Map((form.ratees as FormRatee[]).map((ratee) => [ratee.periodRateeId, ratee.dimensions.map((row) => row.periodRateeDimensionId)]));
        await s.respondent.submit({ id: draft.userId }, periodId, {
            departmentId: draft.departmentId,
            items: items.map(({ rateeId, index, score }) => ({ periodRateeDimensionId: dimensionIds.get(rateeId)![index], score })),
            comments: [...draft.comments.entries()].map(([periodRateeId, comment]) => ({ periodRateeId, comment })),
        }, draft.now);
    }
}

function summarize(drafts: Draft[], plan: Plan, eligible: number) {
    const fewAnswered = drafts.filter((draft) => draft.scores.has(plan.fewRatee)).length;
    console.log(`Penilai basis (site survei): ${eligible}, menjawab: ${drafts.length} (${Math.round((drafts.length / eligible) * 100)}%)`);
    console.log(`PIC dengan sedikit penilai: ${plan.nameOf.get(plan.fewRatee)} (${fewAnswered} penilai)`);
    plan.lowRatees.forEach((id) => console.log(`PIC rendah: ${plan.nameOf.get(id)} rata-rata ${rateeAverage(drafts, id)?.toFixed(2)}`));
    if (plan.tie) console.log(`Seri: ${plan.tie.map((id) => `${plan.nameOf.get(id)} ${rateeAverage(drafts, id)?.toFixed(2)}`).join(' = ')}`);
    console.log(`Komentar: ${drafts.reduce((sum, draft) => sum + draft.comments.size, 0)}`);
}

async function simulate(s: Services) {
    const actorId = await adminId(s.db);
    await removeOldSimulations(s, actorId);
    const periodId = await createSimulation(s, actorId);
    const detail = await s.periods.get(HC, periodId);
    const siteIds = new Set(detail.sites.map((site) => site.id));
    const serviceOf = new Map(detail.ratees.map((ratee) => [ratee.id, ratee.serviceCode]));
    const view = await s.assignments.get(HC, periodId);
    const rng = seededRandom(SEED);
    const plan = planAnswers(rng, view, siteIds, serviceOf);
    const drafts = await draftAnswers(s, rng, periodId, plan);
    if (plan.tie && !forceTie(rng, drafts, plan.tie)) console.warn('Peringatan: seri tidak tercapai');
    addComments(rng, drafts, plan);
    await submitAll(s, periodId, drafts);
    summarize(drafts, plan, pairsByRatee(view, siteIds).eligible.length);
    return periodId;
}

async function exportReport(s: Services, periodId: string) {
    const pdf = await s.exporter.buildPdf(HC, periodId);
    writeFileSync(PDF_PATH, pdf.buffer);
    const workbook = await s.exporter.buildWorkbook(HC, periodId);
    writeFileSync(XLSX_PATH, workbook.buffer);
    console.log(`Tertulis: ${PDF_PATH}\nTertulis: ${XLSX_PATH}`);
}

async function main() {
    if (process.env.DB_DATABASE !== DEMO_DATABASE) throw new Error(`Simulasi hanya boleh di database ${DEMO_DATABASE} (sekarang: ${process.env.DB_DATABASE})`);
    const app = await NestFactory.createApplicationContext(SimulationModule, { logger: ['error', 'warn'] });
    try {
        const s: Services = {
            db: app.get<DataSource>(getDataSourceToken()), templates: app.get(CsiAssignmentTemplateService), applier: app.get(CsiTemplateApplyService),
            periods: app.get(CsiPeriodService), assignments: app.get(CsiAssignmentService), respondent: app.get(CsiRespondentService), exporter: app.get(CsiExportService),
        };
        const periodId = await simulate(s);
        const [{ status }] = await s.db.query('SELECT status FROM csi_periods WHERE id = $1', [periodId]);
        if (status !== CsiPeriodPublishStatus.PUBLISHED) throw new Error(`Survei simulasi tidak terbit (status ${status})`);
        await exportReport(s, periodId);
    } finally {
        await app.close();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
});
