import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiOption, CsiQuestionType } from '../csi.constants';

@Entity('csi_dimensions')
@Index('IDX_csi_dimensions_scope', ['scope'])
export class CsiDimension {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    /** The question text. */
    @Column({ type: 'varchar', length: 300 })
    name: string;

    @Column({ type: 'varchar', length: 300, nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 10, default: CsiQuestionType.STAR })
    type: CsiQuestionType;

    @Column({ default: true })
    required: boolean;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    options: CsiOption[];

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
