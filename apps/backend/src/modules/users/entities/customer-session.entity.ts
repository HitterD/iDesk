import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('customer_sessions')
export class CustomerSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    telegramId: string;

    @CreateDateColumn()
    createdAt: Date;

    @OneToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    @Column({ default: 'IDLE' })
    state: string;

    @Column('simple-json', { nullable: true })
    tempData: Record<string, any>;
}
