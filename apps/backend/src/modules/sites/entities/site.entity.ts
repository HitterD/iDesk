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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
