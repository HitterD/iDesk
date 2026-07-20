import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import { Site } from '../sites/entities/site.entity';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { HrisEmployee, HrisGatewayAdapter } from './hris-gateway.adapter';
import { DEFAULT_HRIS_PASSWORD, resolveRole, resolveSiteCode } from './hris-mapping';

export interface HrisSyncSummary {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

const MAX_PAGES = 500;

@Injectable()
export class HrisSyncService {
    private readonly logger = new Logger(HrisSyncService.name);
    private syncRunning = false;

    constructor(
        private readonly gateway: HrisGatewayAdapter,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(Site) private readonly siteRepo: Repository<Site>,
        @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    ) {}

    @Cron('0 2 * * *', { timeZone: 'Asia/Jakarta', name: 'hris-daily-sync' })
    async scheduledSync(): Promise<void> {
        if (!this.gateway.isConfigured()) return;

        try {
            const summary = await this.syncAll();
            this.logger.log(`HRIS sync completed: created=${summary.created}, updated=${summary.updated}, skipped=${summary.skipped}, errors=${summary.errors.length}`);
        } catch (error: any) {
            this.logger.error(`HRIS scheduled sync failed: ${error.message}`);
        }
    }

    async syncAll(): Promise<HrisSyncSummary> {
        if (this.syncRunning) {
            throw new ConflictException('HRIS sync is already running');
        }

        this.syncRunning = true;
        try {
            const summary: HrisSyncSummary = { created: 0, updated: 0, skipped: 0, errors: [] };
            const siteByCode = await this.loadSiteMap();
            let fetched = 0;
            let total = Number.MAX_SAFE_INTEGER;

            for (let page = 1; page <= MAX_PAGES && fetched < total; page++) {
                const result = await this.gateway.getEmployeesPage(page);
                if (!result || !Array.isArray(result.data)) {
                    summary.errors.push(`page ${page}: fetch failed`);
                    break;
                }

                total = result.total;
                fetched += result.data.length;
                if (result.data.length === 0) break;

                for (const employee of result.data) {
                    try {
                        const action = await this.upsertEmployee(employee, siteByCode);
                        summary[action]++;
                    } catch (error: any) {
                        summary.errors.push(`${employee.nik_hris || 'unknown'}: ${error.message}`);
                    }
                }
            }

            return summary;
        } finally {
            this.syncRunning = false;
        }
    }

    async provisionEmployee(employee: HrisEmployee): Promise<User> {
        if (!employee.nik_hris || !employee.nama_karyawan) {
            throw new Error('HRIS employee is missing NIK or name');
        }

        const siteByCode = await this.loadSiteMap();
        const siteId = this.resolveSiteId(employee.lokasi, siteByCode);
        const departmentId = await this.findOrCreateDepartment(employee.nama_departemen, siteId);
        const user = this.userRepo.create({
            email: await this.resolveUniqueEmail(employee),
            fullName: employee.nama_karyawan,
            employeeId: employee.nik_hris,
            role: resolveRole(employee.nama_departemen),
            siteId: siteId ?? undefined,
            departmentId: departmentId ?? undefined,
            jobTitle: employee.nama_jabatan ?? undefined,
            password: await bcrypt.hash(DEFAULT_HRIS_PASSWORD, BCRYPT_ROUNDS),
            isActive: true,
        });

        return this.userRepo.save(user);
    }

    private async upsertEmployee(
        employee: HrisEmployee,
        siteByCode: Map<string, Site>,
    ): Promise<'created' | 'updated' | 'skipped'> {
        if (!employee.nik_hris || employee.tgl_keluar) return 'skipped';

        const existing = await this.userRepo.findOne({ where: { employeeId: employee.nik_hris } });
        if (!existing) {
            await this.provisionEmployeeFromSiteMap(employee, siteByCode);
            return 'created';
        }

        const siteId = this.resolveSiteId(employee.lokasi, siteByCode);
        existing.fullName = employee.nama_karyawan || existing.fullName;
        existing.jobTitle = employee.nama_jabatan ?? existing.jobTitle;
        existing.siteId = siteId as unknown as string;
        existing.departmentId = (await this.findOrCreateDepartment(employee.nama_departemen, siteId)) as unknown as string;
        await this.userRepo.save(existing);
        return 'updated';
    }

    private async provisionEmployeeFromSiteMap(employee: HrisEmployee, siteByCode: Map<string, Site>): Promise<User> {
        if (!employee.nama_karyawan) {
            throw new Error('HRIS employee is missing name');
        }

        const siteId = this.resolveSiteId(employee.lokasi, siteByCode);
        const departmentId = await this.findOrCreateDepartment(employee.nama_departemen, siteId);
        const user = this.userRepo.create({
            email: await this.resolveUniqueEmail(employee),
            fullName: employee.nama_karyawan,
            employeeId: employee.nik_hris,
            role: resolveRole(employee.nama_departemen),
            siteId: siteId ?? undefined,
            departmentId: departmentId ?? undefined,
            jobTitle: employee.nama_jabatan ?? undefined,
            password: await bcrypt.hash(DEFAULT_HRIS_PASSWORD, BCRYPT_ROUNDS),
            isActive: true,
        });

        return this.userRepo.save(user);
    }

    private async loadSiteMap(): Promise<Map<string, Site>> {
        const sites = await this.siteRepo.find();
        return new Map(sites.map((site) => [site.code.toUpperCase(), site]));
    }

    private resolveSiteId(lokasi: string | null | undefined, sites: Map<string, Site>): string | null {
        const code = resolveSiteCode(lokasi);
        return code ? sites.get(code)?.id ?? null : null;
    }

    private async findOrCreateDepartment(nama: string | null, siteId: string | null): Promise<string | null> {
        const name = nama?.trim();
        if (!name) return null;

        const code = name.toUpperCase();
        let department = await this.departmentRepo.findOne({ where: { code } });
        if (!department) {
            department = await this.departmentRepo.save(
                this.departmentRepo.create({ name, code, siteId: siteId ?? undefined }),
            );
        }
        return department.id;
    }

    private async resolveUniqueEmail(employee: HrisEmployee): Promise<string> {
        const fallback = `${employee.nik_hris}@hris.local`;
        const email = employee.email?.trim().toLowerCase();
        if (!email) return fallback;

        const existing = await this.userRepo.findOne({
            where: { email, employeeId: Not(employee.nik_hris) },
        });
        return existing ? fallback : email;
    }
}
