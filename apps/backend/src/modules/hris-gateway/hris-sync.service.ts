import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import { Site } from '../sites/entities/site.entity';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { HrisEmployee, HrisGatewayAdapter } from './hris-gateway.adapter';
import { DEFAULT_HRIS_PASSWORD, resolveRole, resolveSiteCode } from './hris-mapping';
import { PermissionsService } from '../permissions/permissions.service';

export interface HrisSyncSummary {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export interface HrisDisableSummary {
    disabled: number;
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
        private readonly permissionsService: PermissionsService,
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

    @Cron('0 3 * * *', { timeZone: 'Asia/Jakarta', name: 'hris-daily-disable-departed' })
    async scheduledDisableDeparted(): Promise<void> {
        if (!this.gateway.isConfigured()) return;

        try {
            const summary = await this.disableDepartedEmployees();
            this.logger.log(`HRIS disable-departed completed: disabled=${summary.disabled}, errors=${summary.errors.length}`);
        } catch (error: any) {
            this.logger.error(`HRIS scheduled disable-departed failed: ${error.message}`);
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

        return this.provisionEmployeeFromSiteMap(employee, await this.loadSiteMap());
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
        if (!existing.appliedPresetId) {
            const presetId = await this.permissionsService.resolveDefaultPresetId(existing.role as UserRole);
            if (!presetId) {
                throw new Error(`No active default permission preset for role ${existing.role}`);
            }
            const { presetName } = await this.permissionsService.applyPresetToUser(existing.id, presetId);
            existing.appliedPresetId = presetId;
            existing.appliedPresetName = presetName;
        }
        await this.userRepo.save(existing);
        return 'updated';
    }

    private async provisionEmployeeFromSiteMap(employee: HrisEmployee, siteByCode: Map<string, Site>): Promise<User> {
        if (!employee.nama_karyawan) {
            throw new Error('HRIS employee is missing name');
        }

        const siteId = this.resolveSiteId(employee.lokasi, siteByCode);
        const departmentId = await this.findOrCreateDepartment(employee.nama_departemen, siteId);
        const role = resolveRole(employee.nama_departemen);
        const presetId = await this.permissionsService.resolveDefaultPresetId(role);
        if (!presetId) {
            throw new Error(`No active default permission preset for role ${role}`);
        }
        const preset = await this.permissionsService.getPresetById(presetId);
        const user = this.userRepo.create({
            email: await this.resolveUniqueEmail(employee),
            fullName: employee.nama_karyawan,
            employeeId: employee.nik_hris,
            role,
            appliedPresetId: preset.id,
            appliedPresetName: preset.name,
            siteId: siteId ?? undefined,
            departmentId: departmentId ?? undefined,
            jobTitle: employee.nama_jabatan ?? undefined,
            password: await bcrypt.hash(DEFAULT_HRIS_PASSWORD, BCRYPT_ROUNDS),
            isActive: true,
        });

        const savedUser = await this.userRepo.save(user);
        await this.permissionsService.applyPresetToUser(savedUser.id, preset.id);
        return savedUser;
    }

    /**
     * Disables local users whose NIK no longer appears (or is marked resigned via
     * tgl_keluar) in the HRIS Gateway. Never deletes — only isActive=false — and
     * backfills appliedPresetId first so a disabled user is never left with no preset.
     */
    async disableDepartedEmployees(): Promise<HrisDisableSummary> {
        const summary: HrisDisableSummary = { disabled: 0, errors: [] };
        const activeNiks = await this.fetchActiveNiks(summary);
        if (activeNiks === null) {
            return summary;
        }

        const departedUsers = await this.userRepo
            .createQueryBuilder('user')
            .where('user.employeeId IS NOT NULL')
            .andWhere('user.isActive = :isActive', { isActive: true })
            .getMany();

        for (const user of departedUsers) {
            if (activeNiks.has(user.employeeId)) continue;
            try {
                if (!user.appliedPresetId) {
                    const presetId = await this.permissionsService.resolveDefaultPresetId(user.role as UserRole);
                    if (!presetId) {
                        throw new Error(`No active default permission preset for role ${user.role}`);
                    }
                    await this.permissionsService.applyPresetToUser(user.id, presetId);
                }
                await this.userRepo.update(user.id, { isActive: false });
                summary.disabled++;
            } catch (error: any) {
                summary.errors.push(`${user.employeeId}: ${error.message}`);
            }
        }

        return summary;
    }

    private async fetchActiveNiks(summary: HrisDisableSummary): Promise<Set<string> | null> {
        const niks = new Set<string>();
        let fetched = 0;
        let total = Number.MAX_SAFE_INTEGER;

        for (let page = 1; page <= MAX_PAGES && fetched < total; page++) {
            const result = await this.gateway.getEmployeesPage(page);
            if (!result || !Array.isArray(result.data)) {
                summary.errors.push(`page ${page}: fetch failed`);
                return null;
            }

            total = result.total;
            fetched += result.data.length;
            if (result.data.length === 0) break;

            for (const employee of result.data) {
                if (employee.nik_hris && !employee.tgl_keluar) {
                    niks.add(employee.nik_hris);
                }
            }
        }

        return niks;
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
