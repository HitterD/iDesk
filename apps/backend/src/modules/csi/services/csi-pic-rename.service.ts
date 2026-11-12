import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { normalizeName } from '../org/csi-name-match';
import { CsiPicView, picView } from '../org/csi-org.service';
import { CSI_TEMPLATE_LOCATION_NAMES } from '../org/csi-template-locations';
import { assertHcScope } from './csi-scope.util';
import { surveyStage } from './csi-survey-stage.util';

export const CSI_PIC_NAME_MIN = 2;
export const CSI_PIC_NAME_MAX = 150;
const NAME_LENGTH_MESSAGE = `Nama PIC harus terdiri dari ${CSI_PIC_NAME_MIN}–${CSI_PIC_NAME_MAX} karakter`;
const PIC_NOT_FOUND_MESSAGE = 'PIC tidak ditemukan';

/** Trimmed, single-spaced PIC name; 2–150 characters. */
export function cleanPicName(value: string | null | undefined): string {
    const name = (value ?? '').replace(/\s+/g, ' ').trim();
    if (name.length < CSI_PIC_NAME_MIN || name.length > CSI_PIC_NAME_MAX) throw new BadRequestException(NAME_LENGTH_MESSAGE);
    return name;
}

/** Previous names (normalised, unique) after a rename: the old name joins, the new one leaves. */
export function nextAliases(aliases: readonly string[] | null | undefined, oldName: string, newName: string): string[] {
    const fresh = normalizeName(newName);
    const old = normalizeName(oldName);
    return [...new Set([...(aliases ?? []), ...(old && old !== fresh ? [old] : [])])].filter((alias) => alias !== fresh);
}

/**
 * Renames an HC PIC master (one source for the template card, "Orang & foto" and PIC HC). In one transaction: the
 * master's fullName (the old name kept as an alias so a re-import with the old name still links), every template row
 * linked to it (picName, refused when another row of that template already has the name), and the ratee snapshot of
 * draft surveys (DRAFT, or published but not started, without answers). Running, answered and finished surveys keep
 * the name they were created with.
 */
@Injectable()
export class CsiPicRenameService {
    /** Clock seam for the survey stage. */
    clock: () => Date = () => new Date();

    constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

    async rename(scope: ServiceScope, id: string, fullName: string): Promise<CsiPicView> {
        assertHcScope(scope);
        const name = cleanPicName(fullName);
        return this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(CsiPic);
            const pic = await repo.findOne({ where: { id, scope } });
            if (!pic) throw new NotFoundException(PIC_NOT_FOUND_MESSAGE);
            if (pic.fullName !== name) {
                await this.renameTemplateRows(manager, pic.id, normalizeName(name));
                await this.renameDraftRatees(manager, pic.id, name);
                await repo.save({ ...pic, fullName: name, aliases: nextAliases(pic.aliases, pic.fullName, name) });
            }
            return picView((await repo.findOne({ where: { id, scope }, relations: { user: true } }))!);
        });
    }

    private async renameTemplateRows(manager: EntityManager, picId: string, picName: string) {
        const repo = manager.getRepository(CsiAssignmentTemplatePic);
        const rows = await repo.find({ where: { picId } });
        if (!rows.length) return;
        const templateIds = [...new Set(rows.map((row) => row.templateId))];
        const taken = await repo.find({ where: { templateId: In(templateIds), picName } });
        const clash = taken.find((row) => row.picId !== picId);
        if (clash) {
            const template = await manager.getRepository(CsiAssignmentTemplate).findOne({ where: { id: clash.templateId } });
            const location = template ? CSI_TEMPLATE_LOCATION_NAMES[template.locationCode] ?? template.locationCode : '';
            throw new BadRequestException(`Nama sudah dipakai PIC lain di template ${location}`.trim());
        }
        await repo.update({ id: In(rows.map((row) => row.id)) }, { picName });
    }

    private async renameDraftRatees(manager: EntityManager, picId: string, displayName: string) {
        const ratees = await manager.getRepository(CsiPeriodRatee).find({ where: { picId }, select: { id: true, periodId: true } });
        const periodIds = [...new Set(ratees.map((ratee) => ratee.periodId))];
        if (!periodIds.length) return;
        const periods = await manager.getRepository(CsiPeriod).find({ where: { id: In(periodIds) } });
        const answered = new Set((await manager.getRepository(CsiResponse)
            .find({ where: { periodId: In(periodIds) }, select: { id: true, periodId: true } })).map((row) => row.periodId));
        const now = this.clock();
        const drafts = new Set(periods.filter((period) => surveyStage(period, answered.has(period.id), now) === 'draft').map((period) => period.id));
        const ids = ratees.filter((ratee) => drafts.has(ratee.periodId)).map((ratee) => ratee.id);
        if (ids.length) await manager.getRepository(CsiPeriodRatee).update({ id: In(ids) }, { displayName });
    }
}
