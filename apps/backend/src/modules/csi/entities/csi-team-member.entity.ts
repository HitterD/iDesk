import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CsiTeam } from './csi-team.entity';

/** A named team member can exist without an iDesk account; deleting the account keeps the member. */
@Entity('csi_team_members')
@Unique('UQ_csi_team_members_team_name', ['teamId', 'name'])
export class CsiTeamMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    teamId: string;

    @ManyToOne(() => CsiTeam, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teamId' })
    team: CsiTeam;

    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User | null;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    nik: string | null;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;
}
