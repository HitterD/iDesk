import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import * as bcrypt from 'bcrypt';
import { Readable } from 'stream';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';

import { MailerService } from '@nestjs-modules/mailer';
import { Site } from '../sites/entities/site.entity';
import { Department } from './entities/department.entity';

const USER_EXPORT_FIELDS: Record<string, { label: string; getCsvValue: (u: any) => string; getXlsxValue: (u: any) => any }> = {
    email: { label: 'Email', getCsvValue: u => u.email, getXlsxValue: u => u.email },
    fullName: { label: 'Full Name', getCsvValue: u => u.fullName, getXlsxValue: u => u.fullName },
    role: { label: 'Role', getCsvValue: u => u.role, getXlsxValue: u => u.role },
    siteCode: { label: 'Site Code', getCsvValue: u => u.site?.code || '', getXlsxValue: u => u.site?.code || '' },
    department: { label: 'Department', getCsvValue: u => u.department?.name || '', getXlsxValue: u => u.department?.name || '' },
    employeeId: { label: 'Employee ID', getCsvValue: u => u.employeeId || '', getXlsxValue: u => u.employeeId || '' },
    jobTitle: { label: 'Job Title', getCsvValue: u => u.jobTitle || '', getXlsxValue: u => u.jobTitle || '' },
    phoneNumber: { label: 'Phone Number', getCsvValue: u => u.phoneNumber || '', getXlsxValue: u => u.phoneNumber || '' },
    isActive: { label: 'Active', getCsvValue: u => u.isActive ? 'true' : 'false', getXlsxValue: u => u.isActive ? 'Yes' : 'No' },
    createdAt: { label: 'Created At', getCsvValue: u => u.createdAt?.toISOString().split('T')[0] || '', getXlsxValue: u => u.createdAt?.toISOString().split('T')[0] || '' },
};

@Injectable()
export class UserImportService {
    private readonly logger = new Logger(UserImportService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
        private readonly mailerService: MailerService,
    ) {}

    async importUsers(file: Express.Multer.File, upsert = false): Promise<any> {
        const results: any[] = [];
        const errors: string[] = [];
        let successCount = 0;
        let updatedCount = 0;
        let failedCount = 0;

        // Pre-load sites for lookup
        const sites = await this.siteRepo.find();
        const siteMap = new Map<string, Site>();
        sites.forEach(s => siteMap.set(s.code.toUpperCase(), s));

        // Pre-load departments for lookup
        const departments = await this.departmentRepo.find();
        const deptMap = new Map<string, Department>();
        departments.forEach(d => deptMap.set(d.code?.toUpperCase() || d.name.toUpperCase(), d));

        try {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            
            if (file.originalname.endsWith('.csv') || file.mimetype.includes('csv')) {
                await workbook.csv.read(Readable.from(file.buffer.toString()));
            } else {
                await workbook.xlsx.load(file.buffer);
            }
            
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new BadRequestException('No worksheet found in the file');
            }

            const headers: string[] = [];
            worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
                headers[colNumber] = cell.value?.toString().trim() || '';
            });

            worksheet.eachRow((row: any, rowNumber: number) => {
                if (rowNumber === 1) return; // Skip header
                
                const rowData: any = {};
                row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
                    const header = headers[colNumber];
                    if (header) {
                        rowData[header] = cell.value?.toString().trim() || '';
                    }
                });
                
                if (rowData.email && !rowData.email.toString().startsWith('#')) {
                    results.push(rowData);
                }
            });
        } catch (error) {
            throw new BadRequestException(`Failed to parse file: ${error.message}`);
        }

        const existingUsers = await this.userRepo.find({ select: ['id', 'email', 'employeeId', 'jobTitle', 'phoneNumber'] });
        const existingEmailMap = new Map(existingUsers.map(u => [u.email, u]));

        const deduplicatedResults: any[] = [];
        const seenEmailsInFile = new Set<string>();
        for (const row of results) {
            if (!row.email) {
                deduplicatedResults.push(row);
                continue;
            }
            const emailLower = row.email.toLowerCase().trim();
            if (seenEmailsInFile.has(emailLower)) {
                errors.push(`Duplicate email in file: ${row.email}`);
                failedCount++;
            } else {
                seenEmailsInFile.add(emailLower);
                deduplicatedResults.push(row);
            }
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < deduplicatedResults.length; i += BATCH_SIZE) {
            const batch = deduplicatedResults.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (row) => {
                try {
                    // Validation - required fields
                    if (!row.email || !row.fullName || !row.role) {
                        throw new BadRequestException(`Missing required fields (email, fullName, role) in row: ${JSON.stringify(row)}`);
                    }

                    // Normalize role
                    const role = row.role.toUpperCase() as UserRole;
                    if (!Object.values(UserRole).includes(role)) {
                        throw new BadRequestException(`Invalid role: ${row.role}. Must be ADMIN, MANAGER, AGENT, or USER`);
                    }

                    const existingUser = existingEmailMap.get(row.email);

                    if (existingUser && !upsert) {
                        throw new ConflictException(`Email ${row.email} already exists`);
                    }

                    // Lookup site by code
                    let siteId: string | undefined;
                    if (row.siteCode) {
                        const site = siteMap.get(row.siteCode.toUpperCase());
                        if (site) {
                            siteId = site.id;
                        } else {
                            this.logger.warn(`Site code ${row.siteCode} not found for ${row.email}`);
                        }
                    }

                    // Lookup department by code
                    let departmentId: string | undefined;
                    if (row.departmentCode) {
                        const dept = deptMap.get(row.departmentCode.toUpperCase());
                        if (dept) {
                            departmentId = dept.id;
                        } else {
                            this.logger.warn(`Department code ${row.departmentCode} not found for ${row.email}`);
                        }
                    }

                    // Normalize isActive (default true)
                    const isActive = row.isActive?.toLowerCase() === 'false' || row.isActive === '0' ? false : true;

                    if (existingUser && upsert) {
                        // ── UPSERT: update existing user ──
                        await this.userRepo.update(existingUser.id, {
                            fullName: row.fullName.trim(),
                            role,
                            employeeId: row.employeeId?.trim() || existingUser.employeeId,
                            jobTitle: row.jobTitle?.trim() || existingUser.jobTitle,
                            phoneNumber: row.phoneNumber?.trim() || existingUser.phoneNumber,
                            ...(siteId ? { siteId } : {}),
                            ...(departmentId ? { departmentId } : {}),
                            isActive,
                        });
                        updatedCount++;
                    } else if (!existingUser) {
                        // ── CREATE: new user ──
                        const randomPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
                        const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);

                        const newUser = this.userRepo.create({
                            email: row.email.trim(),
                            fullName: row.fullName.trim(),
                            role,
                            employeeId: row.employeeId?.trim() || null,
                            jobTitle: row.jobTitle?.trim() || null,
                            phoneNumber: row.phoneNumber?.trim() || null,
                            siteId,
                            departmentId,
                            isActive,
                            password: hashedPassword,
                            mustChangePassword: true,
                        });

                        await this.userRepo.save(newUser);
                        // Add to map to prevent duplicates within same import
                        existingEmailMap.set(newUser.email, newUser);

                        // Send Welcome Email
                        try {
                            await this.mailerService.sendMail({
                                to: newUser.email,
                                subject: 'Welcome to iDesk Helpdesk',
                                template: 'welcome-user',
                                context: {
                                    name: newUser.fullName,
                                    email: newUser.email,
                                    password: randomPassword,
                                },
                            });
                        } catch (emailError) {
                            this.logger.warn(`Failed to send email to ${newUser.email}: ${emailError.message}`);
                            errors.push(`User created but email failed for ${newUser.email}`);
                        }

                        successCount++;
                    }
                } catch (error) {
                    failedCount++;
                    errors.push(`Row ${row.email || 'unknown'}: ${error.message}`);
                }
            }));
        }

        return {
            success: successCount,
            updated: updatedCount,
            failed: failedCount,
            errors,
        };
    }

    async generateImportTemplate(): Promise<{ data: Buffer; filename: string }> {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        
        // Data Sheet
        const dataSheet = workbook.addWorksheet('Users');
        dataSheet.columns = [
            { header: 'email', key: 'email', width: 25 },
            { header: 'fullName', key: 'fullName', width: 25 },
            { header: 'role', key: 'role', width: 15 },
            { header: 'siteCode', key: 'siteCode', width: 15 },
            { header: 'departmentCode', key: 'departmentCode', width: 15 },
            { header: 'presetName', key: 'presetName', width: 15 },
            { header: 'employeeId', key: 'employeeId', width: 15 },
            { header: 'jobTitle', key: 'jobTitle', width: 20 },
            { header: 'phoneNumber', key: 'phoneNumber', width: 20 },
            { header: 'isActive', key: 'isActive', width: 15 }
        ];

        // Format header
        dataSheet.getRow(1).font = { bold: true };
        dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        // Fetch existing users
        const users = await this.userRepo.find({
            relations: ['site', 'department', 'appliedPreset']
        });

        // Add users to sheet
        users.forEach(user => {
            dataSheet.addRow({
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                siteCode: user.site?.code || '',
                departmentCode: user.department?.code || '',
                presetName: user.appliedPresetName || '',
                employeeId: user.employeeId || '',
                jobTitle: user.jobTitle || '',
                phoneNumber: user.phoneNumber || '',
                isActive: user.isActive ? 'true' : 'false'
            });
        });

        // Instructions Sheet
        const instSheet = workbook.addWorksheet('Instructions');
        instSheet.getColumn('A').width = 20;
        instSheet.getColumn('B').width = 40;
        
        instSheet.addRow(['Field', 'Valid Values']);
        instSheet.getRow(1).font = { bold: true };
        instSheet.addRow(['Role', 'USER, AGENT, MANAGER, ADMIN']);
        instSheet.addRow(['Site Code', 'SPJ, SMG, KRW, JTB']);
        instSheet.addRow(['Is Active', 'true, false']);
        
        // Add Data Validation (Dropdowns) for existing rows + 100 extra rows
        const maxRows = Math.max(100, users.length + 100);
        for (let i = 2; i <= maxRows; i++) {
            dataSheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"USER,AGENT,MANAGER,ADMIN"']
            };
            dataSheet.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"SPJ,SMG,KRW,JTB"']
            };
            dataSheet.getCell(`J${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"true,false"']
            };
        }

        const buffer = await workbook.xlsx.writeBuffer() as Buffer;
        return {
            data: buffer,
            filename: 'import-users-template.xlsx',
        };
    }

    async exportUsers(fields: string[] = []): Promise<{ data: string; filename: string }> {
        const users = await this.userRepo.find({
            relations: ['department', 'site'],
            order: { fullName: 'ASC' },
            where: {
                email: require('typeorm').Not(require('typeorm').Like('deleted_%'))
            }
        });

        const activeFields = fields.length > 0
            ? fields.filter(f => USER_EXPORT_FIELDS[f])
            : Object.keys(USER_EXPORT_FIELDS);

        const headers = activeFields;
        const rows = users.map(user => activeFields.map(f => USER_EXPORT_FIELDS[f].getCsvValue(user)));

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        return {
            data: csvContent,
            filename: `users-export-${new Date().toISOString().split('T')[0]}.csv`,
        };
    }

    async exportUsersXlsx(siteFilter: string = 'ALL', fields: string[] = []): Promise<Buffer> {
        const users = await this.userRepo.find({
            relations: ['department', 'site'],
            order: { fullName: 'ASC' },
            where: {
                email: require('typeorm').Not(require('typeorm').Like('deleted_%'))
            }
        });

        const activeKeys = fields.length > 0
            ? fields.filter(f => USER_EXPORT_FIELDS[f])
            : Object.keys(USER_EXPORT_FIELDS);

        const headers = activeKeys.map(k => USER_EXPORT_FIELDS[k].label);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk System';
        workbook.created = new Date();

        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2563EB' } },
            alignment: { horizontal: 'center' as const },
        };

        // Determine sites to export
        const allSiteCodes = [...new Set(users.map(u => u.site?.code).filter(Boolean))] as string[];
        const sitesToExport = siteFilter === 'ALL' ? allSiteCodes : [siteFilter];

        for (const siteCode of sitesToExport) {
            const siteUsers = users.filter(u => u.site?.code === siteCode);
            const sheet = workbook.addWorksheet(siteCode);

            // Add headers
            const headerRow = sheet.addRow(headers);
            headerRow.eachCell((cell) => {
                cell.font = headerStyle.font;
                cell.fill = headerStyle.fill;
                cell.alignment = headerStyle.alignment;
            });

            // Add data rows
            for (const user of siteUsers) {
                sheet.addRow(activeKeys.map(k => USER_EXPORT_FIELDS[k].getXlsxValue(user)));
            }

            // Auto-fit columns
            sheet.columns.forEach((column) => {
                column.width = 20;
            });
        }

        // Add Summary sheet if exporting all sites
        if (siteFilter === 'ALL') {
            const summarySheet = workbook.addWorksheet('Summary');
            const summaryHeaders = ['Site', 'Administrators', 'Agents', 'Users', 'Total'];

            const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
            summaryHeaderRow.eachCell((cell) => {
                cell.font = headerStyle.font;
                cell.fill = headerStyle.fill;
                cell.alignment = headerStyle.alignment;
            });

            for (const siteCode of allSiteCodes) {
                const siteUsers = users.filter(u => u.site?.code === siteCode);
                const admins = siteUsers.filter(u => u.role === UserRole.ADMIN).length;
                const agents = siteUsers.filter(u => u.role === UserRole.AGENT).length;
                const usersCount = siteUsers.filter(u => u.role === UserRole.USER).length;
                summarySheet.addRow([siteCode, admins, agents, usersCount, siteUsers.length]);
            }

            summarySheet.columns.forEach((column) => {
                column.width = 15;
            });
        }

        return Buffer.from(await workbook.xlsx.writeBuffer());
    }
}
