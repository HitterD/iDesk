import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TicketPriority } from '../entities/ticket.entity';
import { USER_TEMPLATE_LABEL_MAX, UserTemplateTicketType } from './user-ticket-template.constants';

/** A requester's own saved form for a repetitive request; only its owner sees or uses it. */
@Entity('user_ticket_templates')
@Index('IDX_user_ticket_templates_user_type', ['userId', 'ticketType'])
export class UserTicketTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    /** Form the template belongs to; it only shows on that form. */
    @Column({ type: 'varchar', length: 30 })
    ticketType: UserTemplateTicketType;

    /** Chip text. */
    @Column({ type: 'varchar', length: USER_TEMPLATE_LABEL_MAX })
    label: string;

    @Column({ type: 'varchar', length: 200 })
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'varchar', length: 20 })
    priority: TicketPriority;

    @Column({ type: 'varchar', length: 100, nullable: true })
    category: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    device: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    software: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
