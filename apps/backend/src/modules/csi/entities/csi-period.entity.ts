import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_SLA_TARGET_DEFAULT, CSI_TEAM_LABEL_DEFAULT, CsiPairMode, CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodSite } from './csi-period-site.entity';
import type { CsiUnitRule } from '../org/csi-unit-rules';

@Entity('csi_periods')
@Index('IDX_csi_periods_scope_start', ['scope', 'startDate'])
export class CsiPeriod {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @OneToMany(() => CsiPeriodSite, (periodSite) => periodSite.period, { cascade: ['insert'] })
    sites: CsiPeriodSite[];

    @Column({ type: 'varchar', length: 150 })
    title: string;

    @Column({ type: 'text' })
    intro: string;

    @Column({ type: 'text' })
    thankYou: string;

    @Column({ type: 'date' })
    startDate: string;

    @Column({ type: 'date' })
    endDate: string;

    @Column({ type: 'varchar', length: 10 })
    respondentMode: CsiRespondentMode;

    // Named publishStatus so it never clobbers the computed time `status` in API responses.
    // Fails closed: a period saved without an explicit status stays a draft.
    @Column({ name: 'status', type: 'varchar', length: 10, default: CsiPeriodPublishStatus.DRAFT })
    publishStatus: CsiPeriodPublishStatus;

    @Column({ default: false })
    teamEnabled: boolean;

    @Column({ type: 'varchar', length: 100, default: CSI_TEAM_LABEL_DEFAULT })
    teamLabel: string;

    @Column({ default: true })
    individualEnabled: boolean;

    /**
     * HC per PIC: each respondent picks the PICs who served them (layanan → bagian → PIC, at least one) and rates only
     * those. Off = the old behaviour (every visible ratee is rated).
     */
    @Column({ default: false })
    respondentPicks: boolean;

    /** HC "siapa menilai siapa" per unit (respondent unit → layanan / bagian / PIC); expanded into raters + pairs. */
    @Column({ type: 'jsonb', default: () => "'[]'" })
    unitRules: CsiUnitRule[];

    /** "Respondent picks" mode: the HC target number of respondents (participation basis); null = no target. */
    @Column({ type: 'int', nullable: true })
    targetRespondents: number | null;

    @Column({ type: 'smallint', default: CSI_SLA_TARGET_DEFAULT })
    slaTargetPct: number;

    @Column({ type: 'uuid' })
    createdById: string;

    /** Who rates whom: ALL = every rater rates every subject (no pairs), CUSTOM = the pair matrix; null = not chosen yet. */
    @Column({ type: 'varchar', length: 10, nullable: true })
    pairMode: CsiPairMode | null;

    @Column({ type: 'timestamptz', nullable: true })
    cancelledAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    cancelledById: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    cancelReason: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
