import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CsiAssignmentTemplate } from './csi-assignment-template.entity';
import { CsiAssignmentTemplateRater } from './csi-assignment-template-rater.entity';
import { CsiPic } from './csi-pic.entity';
import { CsiTeam } from './csi-team.entity';

/** One PIC of a template, by name (linked to csi_pics when the name matches exactly one PIC). */
@Entity('csi_assignment_template_pics')
@Index('UQ_csi_assignment_template_pics_name', ['templateId', 'picName'], { unique: true })
export class CsiAssignmentTemplatePic {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    templateId: string;

    @ManyToOne(() => CsiAssignmentTemplate, (template) => template.pics, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'templateId' })
    template: CsiAssignmentTemplate;

    @Column({ type: 'varchar', length: 60 })
    area: string;

    @Column({ type: 'varchar', length: 10 })
    serviceCode: string;

    @Column({ type: 'varchar', length: 150 })
    picName: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    jobTitle: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    serviceFunction: string | null;

    @Column({ type: 'uuid', nullable: true })
    picId: string | null;

    @ManyToOne(() => CsiPic, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'picId' })
    pic: CsiPic | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    picNik: string | null;

    /** Team template rows link here instead of picId. */
    @Column({ type: 'uuid', nullable: true })
    teamId: string | null;

    @ManyToOne(() => CsiTeam, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'teamId' })
    team: CsiTeam | null;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @OneToMany(() => CsiAssignmentTemplateRater, (rater) => rater.templatePic)
    raters: CsiAssignmentTemplateRater[];
}
