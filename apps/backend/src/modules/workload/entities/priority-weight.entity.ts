import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('priority_weights')
export class PriorityWeight {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    priority: string; // LOW, MEDIUM, HIGH, CRITICAL, HARDWARE_INSTALLATION

    @Column()
    points: number;

    @Column({ nullable: true, type: 'text' })
    description: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
