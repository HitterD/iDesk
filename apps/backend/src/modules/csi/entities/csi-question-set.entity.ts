import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';

/**
 * Reusable set of master questions per scope ("Set individu standar", "Set tim"), picked in the
 * "Orang yang dinilai" step to give many people the same questions at once.
 */
@Entity('csi_question_sets')
@Unique('UQ_csi_question_sets_scope_name', ['scope', 'name'])
export class CsiQuestionSet {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    /** Master dimension ids in display order; ids of deactivated questions are dropped when read. */
    @Column({ type: 'jsonb', default: () => "'[]'" })
    dimensionIds: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
