import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export const TV_THEMES = ['light', 'dark'] as const;
export type TvTheme = (typeof TV_THEMES)[number];

@Entity('sites')
export class Site {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 10 })
    code: string; // SPJ, KRW, SKD, SMG, JTB

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

    /** Requests from this site are handled by that site's ICT (SKD → SPJ); null = handled here. */
    @Column({ type: 'uuid', nullable: true })
    handledBySiteId: string | null;

    @Column({ type: 'varchar', nullable: true, unique: true })
    tvToken: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicket: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicketSupport: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicketOracle: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicketWebDev: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicketMobileDev: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneInProgress: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneClosing: string | null;

    @Column({ type: 'varchar', length: 5, nullable: true })
    closingTime: string | null;

    /** TV board hub for the dev teams: also shows Oracle/Web/Mobile Dev tickets from every site. */
    @Column({ default: false })
    tvShowsDevTickets: boolean;

    /** Default TV board palette; a screen can override it locally. */
    @Column({ type: 'varchar', length: 5, default: 'light' })
    tvTheme: TvTheme;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
