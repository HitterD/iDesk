import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
    CREATE_TICKET = 'CREATE_TICKET',
    UPDATE_TICKET = 'UPDATE_TICKET',
    DELETE_TICKET = 'DELETE_TICKET',
    ASSIGN_TICKET = 'ASSIGN_TICKET',
    STATUS_CHANGE = 'STATUS_CHANGE',
    PRIORITY_CHANGE = 'PRIORITY_CHANGE',
    TICKET_REPLY = 'TICKET_REPLY',
    TICKET_MERGE = 'TICKET_MERGE',
    BULK_UPDATE = 'BULK_UPDATE',
    USER_LOGIN = 'USER_LOGIN',
    USER_LOGOUT = 'USER_LOGOUT',
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    SETTINGS_CHANGE = 'SETTINGS_CHANGE',
    ARTICLE_CREATE = 'ARTICLE_CREATE',
    ARTICLE_UPDATE = 'ARTICLE_UPDATE',
    ARTICLE_DELETE = 'ARTICLE_DELETE',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['entityType', 'entityId'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', length: 50 })
    action: AuditAction;

    @Column({ type: 'varchar', length: 50 })
    entityType: string;

    @Column({ type: 'uuid', nullable: true })
    entityId: string;

    @Column({ type: 'jsonb', nullable: true })
    oldValue: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    newValue: Record<string, any>;

    @Column({ type: 'varchar', length: 50, nullable: true })
    ipAddress: string;

    @Column({ type: 'text', nullable: true })
    userAgent: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @CreateDateColumn()
    createdAt: Date;
}
