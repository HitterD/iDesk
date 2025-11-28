import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('saved_searches')
@Index(['userId'])
export class SavedSearch {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column('jsonb')
    filters: Record<string, any>;

    @Column({ nullable: true })
    query: string;

    @Column({ default: false })
    isDefault: boolean;

    @Column({ default: 0 })
    useCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
