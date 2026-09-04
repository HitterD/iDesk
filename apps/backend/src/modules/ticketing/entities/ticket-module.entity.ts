import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { HandlingTeam, TicketType } from './ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

@Entity('ticket_modules')
export class TicketModule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 100, unique: true })
    slug: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'varchar', length: 50, default: 'Ticket' })
    icon: string;

    @Column({ type: 'varchar', length: 30, default: 'blue' })
    color: string;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'boolean', default: false })
    isSystem: boolean;

    @Column({
        type: 'varchar',
        array: true,
        default: () => "ARRAY['OPS_SUPPORT']::varchar[]",
    })
    handlingTeams: HandlingTeam[];

    @Column({
        type: 'varchar',
        array: true,
        default: () => "ARRAY[]::varchar[]",
    })
    categories: string[];

    @Column({
        type: 'varchar',
        array: true,
        default: () => "ARRAY[]::varchar[]",
    })
    ticketTypes: TicketType[];

    @Column({
        type: 'varchar',
        array: true,
        default: () => "ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN', 'MANAGER']::varchar[]",
    })
    allowedRoles: UserRole[];

    @Column({
        type: 'varchar',
        array: true,
        default: () => "ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN']::varchar[]",
        name: 'assignee_roles',
    })
    assigneeRoles: UserRole[];

    /**
     * Explicit per-person assignee pool. When non-empty it WINS over
     * assigneeRoles: only these users may be assigned tickets in this module,
     * and only they enter the auto-assign workload pool. Empty means "fall back
     * to assigneeRoles", which is how every module behaves before an admin
     * curates a list.
     */
    @Column({
        type: 'uuid',
        array: true,
        default: () => "ARRAY[]::uuid[]",
        name: 'assignee_user_ids',
    })
    assigneeUserIds: string[];

    /**
     * Whether tickets landing in this module are auto-assigned by workload.
     * Only IT Support is seeded true; dev queues (Oracle/Web/Mobile) are false
     * so their tickets are never routed into the ops-support pool.
     */
    @Column({ type: 'boolean', default: false, name: 'auto_assign_enabled' })
    autoAssignEnabled: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updatedAt: Date;
}
