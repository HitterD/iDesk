import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiPairMode, CsiRespondentMode } from '../csi.constants';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { addGuideSheet } from '../services/csi-excel-style';
import { addStyledSheet, sanitizeCell } from '../services/csi-export.sheet';
import { lockUnlockedPeriod } from '../services/csi-period-lock.util';
import { assertPeriodInScope } from '../services/csi-scope.util';
import { collapse, locationLabel, locationOfWorkLocation, normalizeBagian, normalizeNik } from './csi-org.constants';

/**
 * "Siapa menilai siapa" as an Excel file: one row per pair (rater NIK → PIC NIK). Export lists the current pairs plus
 * a reference sheet of every PIC; import replaces the period's raters and pairs (dry run first, then commit).
 */
export const PAIRS_SHEET = 'Siapa menilai siapa';
const PIC_SHEET = 'Daftar PIC';
const IMPORT_ROWS_MAX = 20000;
const RATER_NIK_HEADER = 'nik penilai';
const PIC_NIK_HEADER = 'nik pic';
const SAMPLE_SIZE = 10;
const CHUNK = 1000;

export type CsiPairsImportReport = {
    rows: number; pairs: number; raters: number;
    /** Row problems, first ones only (with the Excel row number). */
    problems: Array<{ row: number; message: string }>; problemCount: number; committed: boolean;
};

const cellText = (value: ExcelJS.CellValue): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if ('richText' in value) return value.richText.map((part) => part.text).join('');
        if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
        if ('text' in value) return String(value.text);
        return '';
    }
    return String(value);
};

@Injectable()
export class CsiPairsExcelService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRater) private readonly raters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiPeriodRaterRatee) private readonly pairs: Repository<CsiPeriodRaterRatee>,
        @InjectRepository(CsiPic) private readonly pics: Repository<CsiPic>,
        @InjectRepository(CsiOrgPerson) private readonly people: Repository<CsiOrgPerson>,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    async exportWorkbook(scope: ServiceScope, periodId: string): Promise<{ filename: string; buffer: Buffer }> {
        const period = await this.find(scope, periodId);
        const picRatees = await this.picRatees(period.id);
        const picIds = picRatees.map((ratee) => ratee.picId!);
        const picById = new Map((picIds.length ? await this.pics.find({ where: { id: In(picIds) } }) : []).map((pic) => [pic.id, pic]));
        const raterRows = await this.raters.find({ where: { periodId: period.id }, relations: { user: true } });
        const pairRows = await this.pairs.find({ where: { periodId: period.id } });
        const raterById = new Map(raterRows.map((rater) => [rater.id, rater]));
        const rateeById = new Map(picRatees.map((ratee) => [ratee.id, ratee]));
        const niks = raterRows.map((rater) => normalizeNik(rater.user?.employeeId)).filter((nik): nik is string => !!nik);
        const orgByNik = new Map((niks.length ? await this.people.find({ where: { nik: In(niks) } }) : []).map((person) => [person.nik, person]));
        const rows = pairRows.flatMap((pair) => {
            const rater = raterById.get(pair.periodRaterId);
            const ratee = rateeById.get(pair.periodRateeId);
            if (!rater || !ratee) return [];
            const nik = normalizeNik(rater.user?.employeeId) ?? '';
            const org = orgByNik.get(nik);
            const pic = picById.get(ratee.picId!);
            return [[
                nik, sanitizeCell(rater.user?.fullName), sanitizeCell(org?.division), sanitizeCell(org?.department), sanitizeCell(normalizeBagian(org?.bagian)),
                locationLabel(locationOfWorkLocation(org?.workLocation)) ?? '', ratee.serviceCode ?? '', sanitizeCell(ratee.bagian), pic?.nik ?? '', sanitizeCell(ratee.displayName),
            ]];
        }).sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[1]).localeCompare(String(b[1])) || String(a[9]).localeCompare(String(b[9])));
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk CSI';
        addStyledSheet(workbook, PAIRS_SHEET, [
            { header: 'NIK Penilai', width: 14 }, { header: 'Nama Penilai', width: 28 }, { header: 'Divisi', width: 24 }, { header: 'Departemen', width: 24 },
            { header: 'Bagian', width: 24 }, { header: 'Lokasi', width: 14 }, { header: 'Layanan', width: 10 }, { header: 'Bagian PIC', width: 26 },
            { header: 'NIK PIC', width: 14 }, { header: 'Nama PIC', width: 28 },
        ], rows);
        addStyledSheet(workbook, PIC_SHEET, [
            { header: 'NIK PIC', width: 14 }, { header: 'Nama PIC', width: 30 }, { header: 'Layanan', width: 10 }, { header: 'Bagian PIC', width: 30 }, { header: 'Jabatan', width: 32 },
        ], picRatees.map((ratee) => [picById.get(ratee.picId!)?.nik ?? '', sanitizeCell(ratee.displayName), ratee.serviceCode ?? '', sanitizeCell(ratee.bagian), sanitizeCell(ratee.jobTitle)]));
        addGuideSheet(workbook, 'Cara pakai', 'Siapa menilai siapa', [
            'Satu baris = satu penilai menilai satu PIC.',
            'Yang dibaca saat impor hanya kolom "NIK Penilai" dan "NIK PIC" di sheet "Siapa menilai siapa"; kolom lain sebagai keterangan.',
            'Tambah baris untuk pasangan baru, hapus baris untuk membatalkan. NIK PIC ada di sheet "Daftar PIC".',
            'Impor MENGGANTI seluruh pasangan survei ini dan hanya bisa sebelum ada jawaban.',
        ]);
        return { filename: `siapa-menilai-siapa-${period.id.slice(0, 8)}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    }

    /** Reads the pairs sheet; without `commit` nothing is written (the admin sees the report first). */
    async importWorkbook(scope: ServiceScope, periodId: string, buffer: Buffer, commit: boolean): Promise<CsiPairsImportReport> {
        const period = await this.find(scope, periodId);
        const sheetRows = await this.readRows(buffer);
        const picRatees = await this.picRatees(period.id);
        const pics = picRatees.length ? await this.pics.find({ where: { id: In(picRatees.map((ratee) => ratee.picId!)) } }) : [];
        const rateeByNik = new Map(pics.map((pic) => [pic.nik, picRatees.find((ratee) => ratee.picId === pic.id)!]));
        const raterNiks = [...new Set(sheetRows.map((row) => row.raterNik).filter((nik): nik is string => !!nik))];
        const accounts = raterNiks.length ? await this.users.find({ where: { employeeId: In(raterNiks), isActive: true }, select: { id: true, employeeId: true } }) : [];
        const userByNik = new Map(accounts.map((user) => [user.employeeId, user.id]));
        const problems: CsiPairsImportReport['problems'] = [];
        const pairs = new Map<string, { userId: string; periodRateeId: string }>();
        sheetRows.forEach(({ row, raterNik, picNik }) => {
            if (!raterNik && !picNik) return;
            const userId = raterNik ? userByNik.get(raterNik) : undefined;
            const ratee = picNik ? rateeByNik.get(picNik) : undefined;
            if (!userId) return void problems.push({ row, message: `NIK penilai ${raterNik || '(kosong)'} tidak punya akun iDesk aktif` });
            if (!ratee) return void problems.push({ row, message: `NIK PIC ${picNik || '(kosong)'} bukan PIC di survei ini` });
            if (ratee.userId === userId) return void problems.push({ row, message: 'PIC tidak boleh menilai dirinya sendiri' });
            pairs.set(`${userId}|${ratee.id}`, { userId, periodRateeId: ratee.id });
        });
        const raterIds = [...new Set([...pairs.values()].map((pair) => pair.userId))];
        const report = {
            rows: sheetRows.length, pairs: pairs.size, raters: raterIds.length,
            problems: problems.slice(0, SAMPLE_SIZE), problemCount: problems.length, committed: false,
        };
        if (!commit) return report;
        if (!pairs.size) throw new BadRequestException('Tidak ada pasangan valid di file');
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, period.id);
            await manager.delete(CsiPeriodRaterRatee, { periodId: period.id });
            await manager.delete(CsiPeriodRater, { periodId: period.id });
            const saved = await manager.save(CsiPeriodRater, raterIds.map((userId) => ({ periodId: period.id, userId })));
            const raterOf = new Map(saved.map((rater) => [rater.userId, rater.id]));
            const rows = [...pairs.values()].map((pair) => ({ periodId: period.id, periodRaterId: raterOf.get(pair.userId)!, periodRateeId: pair.periodRateeId }));
            for (let start = 0; start < rows.length; start += CHUNK) await manager.save(CsiPeriodRaterRatee, rows.slice(start, start + CHUNK));
            // The file is now the source of truth: unit rules no longer describe the pairs.
            await manager.update(CsiPeriod, { id: period.id }, {
                respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, respondentPicks: false, unitRules: [],
            });
        });
        return { ...report, committed: true };
    }

    private async readRows(buffer: Buffer) {
        const workbook = new ExcelJS.Workbook();
        try {
            // exceljs types its Buffer differently from Node 22+ (ArrayBufferLike); the runtime value is the same.
            await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
        } catch {
            throw new BadRequestException('File Excel tidak bisa dibaca');
        }
        const sheet = workbook.getWorksheet(PAIRS_SHEET) ?? workbook.worksheets[0];
        if (!sheet) throw new BadRequestException('Sheet tidak ditemukan');
        const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((value) => collapse(cellText(value)).toLowerCase());
        const raterColumn = header.indexOf(RATER_NIK_HEADER);
        const picColumn = header.indexOf(PIC_NIK_HEADER);
        if (raterColumn < 1 || picColumn < 1) throw new BadRequestException('Kolom "NIK Penilai" dan "NIK PIC" wajib ada di baris pertama');
        if (sheet.rowCount - 1 > IMPORT_ROWS_MAX) throw new BadRequestException(`Maksimal ${IMPORT_ROWS_MAX} baris`);
        const rows: Array<{ row: number; raterNik: string | null; picNik: string | null }> = [];
        sheet.eachRow((row, number) => {
            if (number === 1) return;
            const values = row.values as ExcelJS.CellValue[];
            rows.push({ row: number, raterNik: normalizeNik(cellText(values[raterColumn])), picNik: normalizeNik(cellText(values[picColumn])) });
        });
        return rows;
    }

    private picRatees(periodId: string) {
        return this.ratees.find({ where: { periodId, picId: Not(IsNull()) }, order: { sortOrder: 'ASC' } });
    }

    private async find(scope: ServiceScope, periodId: string) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id: periodId } }), scope);
    }
}
