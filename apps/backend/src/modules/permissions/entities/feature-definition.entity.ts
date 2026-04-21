import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../users/enums/user-role.enum';

@Entity('feature_definitions')
export class FeatureDefinition {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    key: string; // e.g., 'ticketing.view', 'zoom_calendar.book'

    @Column()
    name: string; // e.g., 'View Tickets'

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Column({ nullable: true })
    category: string; // e.g., 'Ticketing', 'Scheduling', 'Analytics'

    @Column({ nullable: true })
    icon: string; // Lucide icon name

    @Column('simple-array', { default: 'USER,AGENT' })
    appliesToRoles: string[]; // Which roles can have this feature configured

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
