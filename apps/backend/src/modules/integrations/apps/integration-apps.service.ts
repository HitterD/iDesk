import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { CredentialCipherService } from '../../../shared/core/encryption/credential-cipher.service';
import { IpopCatalogService } from '../ipop/ipop-catalog.service';
import { IntegrationApp } from './entities/integration-app.entity';
import { CreateIntegrationAppDto, UpdateIntegrationAppDto } from './dto/integration-app.dto';
import { RESERVED_CLIENT_IDS } from './integration-app.constants';

const SECRET_BYTES = 32;
const SECRET_HINT_LENGTH = 4;
/** Signed requests look the app up on every call; a short cache keeps that off the database. */
const CACHE_TTL_MS = 30_000;
/** lastUsedAt is informative: write it at most this often per app. */
const TOUCH_INTERVAL_MS = 60_000;

/** What admins see of an app; the secret itself is only returned when it is issued. */
export interface IntegrationAppView {
    id: string;
    clientId: string;
    name: string;
    description: string | null;
    secretHint: string;
    modules: string[];
    permissions: string[];
    webhookUrl: string | null;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** An app with its decrypted secret, for signing checks and webhook delivery only. */
export interface ResolvedApp { app: IntegrationApp; secret: string }

@Injectable()
export class IntegrationAppsService {
    private readonly cache = new Map<string, { value: ResolvedApp | null; until: number }>();

    constructor(
        @InjectRepository(IntegrationApp) private readonly repo: Repository<IntegrationApp>,
        private readonly cipher: CredentialCipherService,
        private readonly catalog: IpopCatalogService,
    ) {}

    async list(): Promise<IntegrationAppView[]> {
        const apps = await this.repo.find({ order: { createdAt: 'ASC' } });
        return apps.map(toView);
    }

    /** Creates the app and returns its secret once; iDesk keeps it encrypted and never shows it again. */
    async create(dto: CreateIntegrationAppDto, actorId: string): Promise<{ app: IntegrationAppView; secret: string }> {
        const clientId = dto.clientId.trim().toLowerCase();
        if (RESERVED_CLIENT_IDS.includes(clientId)) throw new BadRequestException(`clientId "${clientId}" is reserved`);
        if (await this.repo.exists({ where: { clientId } })) throw new ConflictException(`clientId "${clientId}" is already used`);
        await this.assertModules(dto.modules);
        const secret = newSecret();
        const saved = await this.repo.save(this.repo.create({
            clientId,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            secretCipher: this.cipher.encrypt(secret),
            secretHint: secret.slice(-SECRET_HINT_LENGTH),
            modules: unique(dto.modules),
            permissions: unique(dto.permissions),
            webhookUrl: dto.webhookUrl?.trim() || null,
            isActive: dto.isActive ?? true,
            createdById: actorId,
        }));
        this.cache.delete(clientId);
        return { app: toView(saved), secret };
    }

    async update(id: string, dto: UpdateIntegrationAppDto): Promise<IntegrationAppView> {
        const app = await this.findOrThrow(id);
        if (dto.modules) await this.assertModules(dto.modules);
        if (dto.name !== undefined) app.name = dto.name.trim();
        if (dto.description !== undefined) app.description = dto.description?.trim() || null;
        if (dto.modules) app.modules = unique(dto.modules);
        if (dto.permissions) app.permissions = unique(dto.permissions);
        if (dto.webhookUrl !== undefined) app.webhookUrl = dto.webhookUrl?.trim() || null;
        if (dto.isActive !== undefined) app.isActive = dto.isActive;
        const saved = await this.repo.save(app);
        this.cache.delete(app.clientId);
        return toView(saved);
    }

    /** New secret; the old one stops working immediately. */
    async rotateSecret(id: string): Promise<{ app: IntegrationAppView; secret: string }> {
        const app = await this.findOrThrow(id);
        const secret = newSecret();
        app.secretCipher = this.cipher.encrypt(secret);
        app.secretHint = secret.slice(-SECRET_HINT_LENGTH);
        const saved = await this.repo.save(app);
        this.cache.delete(app.clientId);
        return { app: toView(saved), secret };
    }

    async remove(id: string): Promise<void> {
        const app = await this.findOrThrow(id);
        await this.repo.delete(app.id);
        this.cache.delete(app.clientId);
    }

    /** Active app by its public id, with the secret decrypted; null when unknown or disabled. */
    async resolveActive(clientId: string, now = Date.now()): Promise<ResolvedApp | null> {
        const key = clientId.toLowerCase();
        const hit = this.cache.get(key);
        if (hit && hit.until > now) return hit.value;
        const app = await this.repo.findOne({ where: { clientId: key } });
        const value = app?.isActive ? { app, secret: this.cipher.decrypt(app.secretCipher) } : null;
        this.cache.set(key, { value, until: now + CACHE_TTL_MS });
        return value;
    }

    /** Active app by the externalSource of its tickets (upper-case client id). */
    resolveBySource(source: string): Promise<ResolvedApp | null> {
        return this.resolveActive(source.toLowerCase());
    }

    async touch(app: IntegrationApp, now = new Date()): Promise<void> {
        if (app.lastUsedAt && now.getTime() - new Date(app.lastUsedAt).getTime() < TOUCH_INTERVAL_MS) return;
        app.lastUsedAt = now;
        await this.repo.update(app.id, { lastUsedAt: now });
    }

    private async findOrThrow(id: string): Promise<IntegrationApp> {
        const app = await this.repo.findOne({ where: { id } });
        if (!app) throw new NotFoundException('Integration app not found');
        return app;
    }

    private async assertModules(modules: string[]): Promise<void> {
        const known = (await this.catalog.listModules()).map((m) => m.slug);
        const unknown = modules.filter((slug) => !known.includes(slug));
        if (unknown.length > 0) throw new BadRequestException(`Unknown or inactive module: ${unknown.join(', ')}`);
    }
}

function newSecret(): string {
    return randomBytes(SECRET_BYTES).toString('base64url');
}

function unique<T>(values: T[]): T[] {
    return [...new Set(values)];
}

function toView(app: IntegrationApp): IntegrationAppView {
    return {
        id: app.id,
        clientId: app.clientId,
        name: app.name,
        description: app.description,
        secretHint: app.secretHint,
        modules: app.modules ?? [],
        permissions: app.permissions ?? [],
        webhookUrl: app.webhookUrl,
        isActive: app.isActive,
        lastUsedAt: app.lastUsedAt,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
    };
}
