import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';

@Entity('access_types')
export class AccessType {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    name: string; // WiFi, VPN, Website

    @Column({ nullable: true })
    formTemplateUrl: string; // Template form PDF

    @Column({ default: true })
    requiresSuperiorSignature: boolean;

    @Column({ default: true })
    requiresUserSignature: boolean;

    @Column({ nullable: true })
    validityDays: number; // How long the access is valid

    @Column({ nullable: true, type: 'text' })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    customFields: any[]; // Stores dynamic form field definitions

    @Column({ type: 'varchar', nullable: true })
    siteId: string;

    @ManyToOne(() => Site, { nullable: true })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
