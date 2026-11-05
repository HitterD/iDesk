import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Raw, Repository } from 'typeorm';
import { PickKeysByType } from 'typeorm/common/PickKeysByType';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiRater } from '../entities/csi-rater.entity';
import { CreateDepartmentDto, CreateDimensionDto, DEFAULT_USER_SEARCH_LIMIT, MAX_USER_SEARCH_LIMIT, UpdateDepartmentDto, UpdateDimensionDto } from '../dto/master.dto';
import { CsiQuestionType } from '../csi.constants';
import { INVALID_OPTIONS_MESSAGE, optionsMatchType } from '../csi-question.util';
import { CSI_TEMPLATE_2025, CSI_TEMPLATE_HC } from '../csi-template';

const INCOMPLETE_ORDER_MESSAGE = 'Urutan tidak lengkap';
type Ordered = { id: string; scope: ServiceScope; sortOrder: number };

/** Blank short labels are stored as null (reports then fall back to the question text). */
const normalizeShortLabel = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() || null);

function assertOptionsMatchType(type: CsiQuestionType, options: unknown) {
    if (!optionsMatchType(type, options ?? [])) throw new BadRequestException(INVALID_OPTIONS_MESSAGE);
}

@Injectable()
export class CsiMasterService {
    constructor(
        @InjectRepository(CsiDimension) private readonly dimensions: Repository<CsiDimension>,
        @InjectRepository(CsiDepartment) private readonly departments: Repository<CsiDepartment>,
        @InjectRepository(CsiRater) private readonly raters: Repository<CsiRater>,
        @InjectRepository(User) private readonly users: Repository<User>,
    ) { }

    listDimensions(scope: ServiceScope, includeInactive = false) {
        return this.dimensions.find({ where: { scope, ...(!includeInactive ? { isActive: true } : {}) },
            order: { sortOrder: 'ASC', name: 'ASC' } });
    }

    async createDimension(scope: ServiceScope, dto: CreateDimensionDto) {
        const options = dto.options ?? [];
        assertOptionsMatchType(dto.type, options);
        const sortOrder = await this.nextSortOrder(this.dimensions, scope);
        return this.dimensions.save(this.dimensions.create({
            ...dto, scope, shortLabel: normalizeShortLabel(dto.shortLabel) ?? null, required: dto.required ?? true, options, sortOrder,
        }));
    }

    /** Appends the scope's standard questionnaire (ICT: CSI 2025; HC: the HC set). Not idempotent. */
    async createTemplateDimensions(scope: ServiceScope) {
        const start = await this.nextSortOrder(this.dimensions, scope);
        const template = scope === ServiceScope.HC ? CSI_TEMPLATE_HC : CSI_TEMPLATE_2025;
        return this.dimensions.save(template.map((question, index) => this.dimensions.create({
            scope, name: question.name, description: null, type: question.type, required: true,
            options: question.options.map((option) => ({ ...option })), sortOrder: start + index,
        })));
    }

    reorderDimensions(scope: ServiceScope, ids: string[]) {
        return this.reorder(this.dimensions, scope, ids);
    }

    reorderDepartments(scope: ServiceScope, ids: string[]) {
        return this.reorder(this.departments, scope, ids);
    }

    deactivateDimension(scope: ServiceScope, id: string) {
        return this.updateDimension(scope, id, { isActive: false });
    }

    listDepartments(scope: ServiceScope, includeInactive = false) {
        return this.departments.find({ where: { scope, ...(!includeInactive ? { isActive: true } : {}) },
            order: { sortOrder: 'ASC', name: 'ASC' } });
    }

    async updateDepartment(scope: ServiceScope, id: string, dto: UpdateDepartmentDto) {
        const department = await this.departments.findOne({ where: { id, scope } });
        if (!department) throw new NotFoundException('Departemen tidak ditemukan');
        if (dto.name !== undefined) await this.assertDepartmentNameAvailable(scope, dto.name, id);
        return this.saveDepartment({ ...department, ...dto });
    }

    deactivateDepartment(scope: ServiceScope, id: string) {
        return this.updateDepartment(scope, id, { isActive: false });
    }

    async updateDimension(scope: ServiceScope, id: string, dto: UpdateDimensionDto) {
        const dimension = await this.dimensions.findOne({ where: { id, scope } });
        if (!dimension) throw new NotFoundException('Dimensi tidak ditemukan');
        const shortLabel = normalizeShortLabel(dto.shortLabel);
        const next = { ...dimension, ...dto, ...(shortLabel !== undefined ? { shortLabel } : {}) };
        if (dto.type !== undefined || dto.options !== undefined) assertOptionsMatchType(next.type, next.options);
        return this.dimensions.save(next);
    }

    async createDepartment(scope: ServiceScope, dto: CreateDepartmentDto) {
        await this.assertDepartmentNameAvailable(scope, dto.name);
        const sortOrder = await this.nextSortOrder(this.departments, scope);
        return this.saveDepartment(this.departments.create({ ...dto, scope, sortOrder }));
    }

    /** New master rows always go to the bottom of their scope. */
    private async nextSortOrder<T extends Ordered>(repository: Repository<T>, scope: ServiceScope) {
        const max = await repository.maximum('sortOrder' as PickKeysByType<T, number>, { scope } as FindOptionsWhere<T>);
        return max === null || max === undefined ? 0 : max + 1;
    }

    /** `ids` must be exactly the scope's rows (active and inactive); sortOrder becomes the index. */
    private async reorder<T extends Ordered>(repository: Repository<T>, scope: ServiceScope, ids: string[]) {
        const rows = await repository.find({ where: { scope } as FindOptionsWhere<T> });
        const byId = new Map(rows.map((row) => [row.id, row]));
        const complete = ids.length === rows.length && new Set(ids).size === ids.length && ids.every((id) => byId.has(id));
        if (!complete) throw new BadRequestException(INCOMPLETE_ORDER_MESSAGE);
        return repository.save(ids.map((id, index): T => ({ ...byId.get(id)!, sortOrder: index })));
    }

    private async assertDepartmentNameAvailable(scope: ServiceScope, name: string, excludeId?: string) {
        const duplicate = await this.departments.findOne({ where: {
            scope, name: Raw((column) => `LOWER(${column}) = LOWER(:name)`, { name }),
        } });
        if (duplicate && duplicate.id !== excludeId) throw new ConflictException('Nama departemen sudah digunakan');
    }

    private async saveDepartment(department: CsiDepartment) {
        try {
            return await this.departments.save(department);
        } catch (error) {
            if (error?.code === '23505') throw new ConflictException('Nama departemen sudah digunakan');
            throw error;
        }
    }

    listRaters(scope: ServiceScope) {
        return this.raters.find({ where: { scope }, relations: { user: { site: true } },
            select: { id: true, scope: true, userId: true, createdAt: true, updatedAt: true,
                user: { id: true, fullName: true, email: true, jobTitle: true, site: { name: true, code: true } } },
            order: { user: { fullName: 'ASC' } },
        });
    }

    async removeRater(scope: ServiceScope, id: string) {
        const rater = await this.raters.findOne({ where: { id, scope } });
        if (!rater) throw new NotFoundException('Penilai tidak ditemukan');
        await this.raters.delete({ id, scope });
        return rater;
    }

    searchUsers(search = '', limit = DEFAULT_USER_SEARCH_LIMIT) {
        if (!Number.isInteger(limit) || limit < 1) throw new BadRequestException('Batas hasil harus berupa bilangan bulat positif');
        const term = search.trim();
        return this.users.find({
            where: term ? [
                { isActive: true, fullName: ILike(`%${term}%`) },
                { isActive: true, email: ILike(`%${term}%`) },
                { isActive: true, employeeId: ILike(`%${term}%`) },
            ] : { isActive: true },
            select: { id: true, fullName: true, email: true, jobTitle: true, siteId: true, site: { code: true, name: true } },
            relations: { site: true }, order: { fullName: 'ASC' }, take: Math.min(limit, MAX_USER_SEARCH_LIMIT),
        });
    }

    async addRaters(scope: ServiceScope, userIds: string[]) {
        const ids = [...new Set(userIds)];
        if (!ids.length) return this.listRaters(scope);
        const users = await this.users.find({ where: { id: In(ids), isActive: true }, select: { id: true } });
        if (users.length !== ids.length) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const existing = await this.raters.find({ where: { scope, userId: In(ids) } });
        const registered = new Set(existing.map((row) => row.userId));
        const additions = ids.filter((id) => !registered.has(id)).map((userId) => this.raters.create({ scope, userId }));
        if (additions.length) await this.raters.save(additions);
        return this.listRaters(scope);
    }
}
