import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Employee directory imported from the approver hierarchy workbook (upserted on every import). CSI reads it to know
 * the division / department / bagian / work location of a respondent (by the account's NIK) and to list HC PICs.
 */
@Entity('csi_org_people')
export class CsiOrgPerson {
    @PrimaryColumn({ type: 'varchar', length: 20 })
    nik: string;

    @Column({ type: 'varchar', length: 150 })
    fullName: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    division: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    department: string | null;

    /** As in the sheet (location suffix kept); normalised on use. */
    @Column({ type: 'varchar', length: 150, nullable: true })
    bagian: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    jobTitle: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    jobLevel: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    workLocation: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
