import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiAssignmentTemplatePic } from './csi-assignment-template-pic.entity';

/**
 * "Siapa menilai siapa" kept per location (one per scope + location, e.g. HC Semarang): the PICs with their service
 * function and their raters by name. Reused for every survey of that location; editing it never touches a period
 * until the admin applies it.
 */
@Entity('csi_assignment_templates')
@Index('UQ_csi_assignment_templates_scope_location', ['scope', 'locationCode'], { unique: true })
export class CsiAssignmentTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    /** Site code (SMG, SPJ, KRW, JTB). */
    @Column({ type: 'varchar', length: 10 })
    locationCode: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @OneToMany(() => CsiAssignmentTemplatePic, (pic) => pic.template)
    pics: CsiAssignmentTemplatePic[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
