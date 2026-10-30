import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { AppColor, AppPermission } from '../integration-app.constants';

/**
 * Another office application (e.g. EBBK) allowed to file and follow tickets through the API.
 * Each app has its own signing secret, the ticket modules it may use and the features it may call.
 */
@Entity('integration_apps')
export class IntegrationApp {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Public id sent in `x-idesk-client-id`; also the tickets' externalSource (upper-cased). */
    @Index('UQ_integration_apps_client_id', { unique: true })
    @Column({ type: 'varchar', length: 20 })
    clientId: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 300, nullable: true })
    description: string | null;

    /** Dot colour of the ticket source badge (APP_COLORS); null = derived from clientId. */
    @Column({ type: 'varchar', length: 16, nullable: true })
    color: AppColor | null;

    /** HMAC secret, encrypted with CredentialCipherService; shown in plain text only when issued. */
    @Column({ type: 'text' })
    secretCipher: string;

    /** Last 4 characters, so admins can tell which secret an app is using. */
    @Column({ type: 'varchar', length: 8 })
    secretHint: string;

    /** Ticket module slugs the app may file into (e.g. ['web-developer']). */
    @Column({ type: 'jsonb', default: () => `'[]'` })
    modules: string[];

    @Column({ type: 'jsonb', default: () => `'[]'` })
    permissions: AppPermission[];

    /** Where iDesk POSTs signed ticket events; null = no callbacks. */
    @Column({ type: 'varchar', length: 500, nullable: true })
    webhookUrl: string | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    lastUsedAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    createdById: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
