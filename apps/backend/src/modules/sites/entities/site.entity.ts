import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('sites')
export class Site {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 10 })
    code: string; // SPJ, SMG, KRW, JTB

    @Column({ length: 100 })
    name: string;

    @Column({ nullable: true, type: 'text' })
    description: string;

    @Column({ type: 'varchar', nullable: true })
    vpnIpRange: string;

    @Column({ type: 'varchar', nullable: true })
    localGateway: string;

    @Column({ default: 'Asia/Jakarta' })
    timezone: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isServerHost: boolean; // TRUE for SPJ (main server)

    @Column({ type: 'varchar', nullable: true, unique: true })
    tvToken: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicket: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneInProgress: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneClosing: string | null;

    @Column({ type: 'varchar', length: 5, nullable: true })
    closingTime: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
