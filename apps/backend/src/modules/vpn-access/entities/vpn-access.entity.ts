import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, DeleteDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum VpnArea {
    KARAWANG = 'Karawang',
    JAKARTA = 'Jakarta',
    SEPANJANG = 'Sepanjang',
    SEMARANG = 'Semarang',
}

export enum VpnStatusCreate {
    SELESAI = 'Selesai',
    PROSES = 'Proses',
    BATAL = 'Batal',
    NON_AKTIF = 'Non Aktif',
}

@Entity('vpn_access')
@Index(['tanggalNonAktif', 'statusCreateVpn'])
export class VpnAccess {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: VpnArea,
        default: VpnArea.JAKARTA,
    })
    area: VpnArea;

    @Column({ default: '-' })
    namaUser: string;

    @Column({ type: 'varchar', nullable: true })
    emailUser: string;

    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    tanggalAktif: Date;

    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    tanggalNonAktif: Date;

    @Column({
        type: 'enum',
        enum: VpnStatusCreate,
        default: VpnStatusCreate.SELESAI,
    })
    statusCreateVpn: VpnStatusCreate;

    @Column({ type: 'varchar', nullable: true })
    keteranganNonAktifVpn: string;

    @Column({ type: 'varchar', nullable: true })
    statusUserH1: string;

    @Column({ type: 'varchar', nullable: true })
    statusIctH1: string;

    @Column({ type: 'varchar', nullable: true }) // Keeping internal tracking fields
    requestedById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'requestedById' })
    requestedBy: User;

    @Column({ type: 'varchar', nullable: true })
    approvedById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'approvedById' })
    approvedBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;

    isExpired(): boolean {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const expiry = new Date(this.tanggalNonAktif);
        expiry.setUTCHours(0, 0, 0, 0);
        return today > expiry;
    }
}
