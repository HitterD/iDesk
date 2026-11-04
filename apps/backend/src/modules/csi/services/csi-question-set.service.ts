import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { QuestionSetDto } from '../dto/question-set.dto';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiQuestionSet } from '../entities/csi-question-set.entity';

const NOT_FOUND_MESSAGE = 'Set pertanyaan tidak ditemukan';
const DUPLICATE_MESSAGE = 'Nama set pertanyaan sudah digunakan';
const UNKNOWN_QUESTION_MESSAGE = 'Set berisi pertanyaan yang tidak aktif atau bukan milik unit ini';
const PG_UNIQUE_VIOLATION = '23505';

/** Reusable question sets per scope; ids of questions deactivated later are dropped on read. */
@Injectable()
export class CsiQuestionSetService {
    constructor(
        @InjectRepository(CsiQuestionSet) private readonly sets: Repository<CsiQuestionSet>,
        @InjectRepository(CsiDimension) private readonly dimensions: Repository<CsiDimension>,
    ) { }

    async list(scope: ServiceScope) {
        const [sets, active] = await Promise.all([
            this.sets.find({ where: { scope }, order: { name: 'ASC' } }),
            this.dimensions.find({ where: { scope, isActive: true }, select: { id: true } }),
        ]);
        const known = new Set(active.map((row) => row.id));
        return sets.map((set) => ({ ...set, dimensionIds: (set.dimensionIds ?? []).filter((id) => known.has(id)) }));
    }

    async create(scope: ServiceScope, dto: QuestionSetDto) {
        await this.assertQuestions(scope, dto.dimensionIds);
        await this.assertNameFree(scope, dto.name);
        return this.save(this.sets.create({ scope, name: dto.name, dimensionIds: unique(dto.dimensionIds) }));
    }

    async update(scope: ServiceScope, id: string, dto: QuestionSetDto) {
        const set = await this.sets.findOne({ where: { id, scope } });
        if (!set) throw new NotFoundException(NOT_FOUND_MESSAGE);
        await this.assertQuestions(scope, dto.dimensionIds);
        await this.assertNameFree(scope, dto.name, id);
        return this.save({ ...set, name: dto.name, dimensionIds: unique(dto.dimensionIds) });
    }

    async remove(scope: ServiceScope, id: string) {
        const set = await this.sets.findOne({ where: { id, scope } });
        if (!set) throw new NotFoundException(NOT_FOUND_MESSAGE);
        await this.sets.delete({ id, scope });
        return { deleted: true as const };
    }

    private async assertQuestions(scope: ServiceScope, ids: string[]) {
        const wanted = unique(ids);
        const found = wanted.length ? await this.dimensions.count({ where: { id: In(wanted), scope, isActive: true } }) : 0;
        if (found !== wanted.length) throw new BadRequestException(UNKNOWN_QUESTION_MESSAGE);
    }

    private async assertNameFree(scope: ServiceScope, name: string, excludeId?: string) {
        const duplicate = await this.sets.findOne({ where: { scope, name: Raw((column) => `LOWER(${column}) = LOWER(:name)`, { name }) } });
        if (duplicate && duplicate.id !== excludeId) throw new ConflictException(DUPLICATE_MESSAGE);
    }

    private async save(set: CsiQuestionSet) {
        try {
            return await this.sets.save(set);
        } catch (error) {
            if ((error as { code?: string })?.code === PG_UNIQUE_VIOLATION) throw new ConflictException(DUPLICATE_MESSAGE);
            throw error;
        }
    }
}

const unique = (ids: string[]) => [...new Set(ids)];
