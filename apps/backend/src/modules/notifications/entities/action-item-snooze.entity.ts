import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('action_item_snooze')
@Index(['userId', 'entityType', 'entityId'], { unique: true })
export class ActionItemSnooze {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    entityType: string;

    @Column()
    entityId: string;

    @Column({ type: 'timestamp' })
    snoozedUntil: Date;

    @CreateDateColumn()
    createdAt: Date;
}
