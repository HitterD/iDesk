import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from '../../settings/entities/system-settings.entity';
import { SignoffLayout, sanitizeSignoff } from '../generators/report-signoff';

export const SIGNOFF_REPORT_TYPES = ['monthly', 'agent-performance', 'ticket-volume'] as const;
export type SignoffReportType = (typeof SIGNOFF_REPORT_TYPES)[number];
/** CSI survey report, one layout per CSI scope (managed from the CSI admin pages, not the generic reports API). */
export type CsiSignoffType = 'csi-ICT' | 'csi-HC';
type StoredSignoffType = SignoffReportType | CsiSignoffType;

const ALL_SITES = 'ALL';
const keyFor = (type: StoredSignoffType, siteId?: string | null) => `reports.signoff.${type}.${siteId || ALL_SITES}`;

/** Saved sign-off defaults: one per report type and site, with an "all sites" entry as the next fallback. */
@Injectable()
export class ReportSignoffService {
    constructor(@InjectRepository(SystemSettings) private readonly settings: Repository<SystemSettings>) { }

    /** The saved layout for this site, else the all-sites one, else undefined (the generator then uses its built-in default). */
    async resolve(type: StoredSignoffType, siteId?: string | null): Promise<SignoffLayout | undefined> {
        const keys = siteId ? [keyFor(type, siteId), keyFor(type)] : [keyFor(type)];
        for (const key of keys) {
            const row = await this.settings.findOne({ where: { key } });
            const layout = sanitizeSignoff(row?.value, undefined);
            if (layout) return layout;
        }
        return undefined;
    }

    async save(type: StoredSignoffType, siteId: string | null | undefined, raw: unknown, userId?: string): Promise<SignoffLayout> {
        const layout = sanitizeSignoff(raw, undefined);
        if (!layout) throw new BadRequestException('Layout tanda tangan tidak valid');
        const key = keyFor(type, siteId);
        const existing = await this.settings.findOne({ where: { key } });
        await this.settings.save(
            existing
                ? { ...existing, value: layout, updatedBy: userId ?? 'system' }
                : this.settings.create({ key, value: layout, category: 'reports', description: `Tanda tangan laporan ${type}`, updatedBy: userId }),
        );
        return layout;
    }

    /** Back to the built-in default for this site. */
    async reset(type: StoredSignoffType, siteId?: string | null): Promise<void> {
        await this.settings.delete({ key: keyFor(type, siteId) });
    }
}
