import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CsiAssignmentTemplatePic } from './csi-assignment-template-pic.entity';

/** One rater of a template PIC, by name; `userId` is set once the name matches exactly one active account. */
@Entity('csi_assignment_template_raters')
@Index('UQ_csi_assignment_template_raters_name', ['templatePicId', 'raterName'], { unique: true })
export class CsiAssignmentTemplateRater {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    templatePicId: string;

    @ManyToOne(() => CsiAssignmentTemplatePic, (pic) => pic.raters, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'templatePicId' })
    templatePic: CsiAssignmentTemplatePic;

    @Column({ type: 'varchar', length: 150 })
    raterName: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    raterJobTitle: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    raterNik: string | null;

    @Column({ type: 'timestamp', nullable: true })
    confirmedAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    confirmedById: string | null;

    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User | null;
}
