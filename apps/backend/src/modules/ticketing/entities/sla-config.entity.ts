import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { TicketPriority } from './ticket.entity';

@Entity('sla_configs')
export class SlaConfig {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        unique: true,
        nullable: true,
    })
    priority: string;

    @Column({ type: 'int', default: 1440 }) // 24 hours
    resolutionTimeMinutes: number;

    @Column({ type: 'int', default: 60 })
    responseTimeMinutes: number;
}
