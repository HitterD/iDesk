import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('ticket_templates')
export class TicketTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ nullable: true })
    category: string;

    @Column({ nullable: true })
    priority: string;

    @Column({ type: 'text', nullable: true })
    defaultContent: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'jsonb', nullable: true })
    customFields: Record<string, any>;

    @Column({ default: 0 })
    usageCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
