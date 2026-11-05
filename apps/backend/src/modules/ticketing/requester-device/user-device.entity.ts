import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HOSTNAME_MAX, IP_MAX } from './requester-device.constants';

/** A computer a user is signed in on, as last reported by the desktop app heartbeat. */
@Entity('user_devices')
@Unique('UQ_user_devices_user_hostname', ['userId', 'hostname'])
@Index('IDX_user_devices_user_seen', ['userId', 'lastSeenAt'])
export class UserDevice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', length: HOSTNAME_MAX })
    hostname: string;

    @Column({ type: 'varchar', length: IP_MAX, nullable: true })
    lanIp: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    windowsUser: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    osVersion: string | null;

    @Column({ type: 'varchar', length: 30, nullable: true })
    appVersion: string | null;

    @Column({ type: 'timestamp', default: () => 'now()' })
    lastSeenAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
