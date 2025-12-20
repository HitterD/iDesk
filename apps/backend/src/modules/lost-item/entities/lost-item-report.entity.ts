import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';

export enum LostItemStatus {
    REPORTED = 'REPORTED',
    SEARCHING = 'SEARCHING',
    FOUND = 'FOUND',
    CLOSED_LOST = 'CLOSED_LOST',
}

@Entity('lost_item_reports')
export class LostItemReport {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ticketId: string;

    @ManyToOne(() => Ticket)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    itemType: string; // Laptop, HP, ID Card, Kunci, Tas, Lainnya

    @Column()
    itemName: string;

    @Column({ nullable: true })
    serialNumber: string;

    @Column({ nullable: true })
    assetTag: string;

    @Column('text')
    lastSeenLocation: string;

    @Column()
    lastSeenDatetime: Date;

    @Column('text')
    circumstances: string; // How it was lost

    @Column({ nullable: true, type: 'text' })
    witnessContact: string;

    @Column({ default: false })
    hasPoliceReport: boolean;

    @Column({ nullable: true })
    policeReportNumber: string;

    @Column({ nullable: true })
    policeReportFile: string; // File upload path

    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    estimatedValue: number;

    @Column({ default: false })
    finderRewardOffered: boolean;

    @Column({
        type: 'enum',
        enum: LostItemStatus,
        default: LostItemStatus.REPORTED,
    })
    status: LostItemStatus;

    // Found information
    @Column({ nullable: true })
    foundAt: Date;

    @Column({ nullable: true, type: 'text' })
    foundLocation: string;

    @Column({ nullable: true })
    foundBy: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
