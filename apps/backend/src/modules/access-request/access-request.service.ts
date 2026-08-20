import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AccessRequest, AccessRequestStatus } from './entities/access-request.entity';
import { AccessType } from './entities/access-type.entity';
import { Ticket, TicketType, TicketStatus, TicketPriority } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { CreateAccessRequestDto, VerifyAccessRequestDto, CreateAccessCredentialsDto, RejectAccessRequestDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CredentialCipherService } from '../../shared/core/encryption/credential-cipher.service';
import { SiteActor, assertSiteAccess, resolveSiteScope } from '../../shared/core/utils/site-scope.util';

@Injectable()
export class AccessRequestService {
    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(AccessRequest)
        private readonly accessRequestRepo: Repository<AccessRequest>,
        @InjectRepository(AccessType)
        private readonly accessTypeRepo: Repository<AccessType>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventEmitter: EventEmitter2,
        private readonly cipher: CredentialCipherService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    async create(userId: string, dto: CreateAccessRequestDto): Promise<AccessRequest> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const accessType = await this.accessTypeRepo.findOne({ where: { id: dto.accessTypeId } });
        if (!accessType) throw new NotFoundException('Access type not found');

        // Create ticket
        const ticket = this.ticketRepo.create({
            title: dto.title || `Access Request: ${accessType.name}`,
            description: dto.description || `Request for ${accessType.name} access. Purpose: ${dto.purpose}`,
            ticketType: TicketType.ACCESS_REQUEST,
            status: TicketStatus.TODO,
            priority: TicketPriority.MEDIUM,
            category: 'ACCESS_REQUEST',
            userId: userId,
            siteId: user.siteId,
        } as Partial<Ticket>);

        const savedTicket = await this.ticketRepo.save(ticket);

        // Create Access Request
        const accessRequest = this.accessRequestRepo.create({
            ticketId: savedTicket.id,
            accessTypeId: dto.accessTypeId,
            requestedAccess: dto.requestedAccess,
            purpose: dto.purpose,
            customFormData: dto.customFormData,
            validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
            validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
            status: AccessRequestStatus.FORM_PENDING,
            formGeneratedAt: new Date(),
        } as Partial<AccessRequest>);

        const saved = await this.accessRequestRepo.save(accessRequest);

        this.eventEmitter.emit('access-request.created', { accessRequest: saved, ticket: savedTicket, user, accessType });

        return saved;
    }

    async findAll(actor: SiteActor, options: { siteId?: string; status?: string } = {}): Promise<AccessRequest[]> {
        const qb = this.accessRequestRepo.createQueryBuilder('ar')
            .leftJoinAndSelect('ar.ticket', 'ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ar.accessType', 'accessType')
            .leftJoinAndSelect('ar.verifiedBy', 'verifiedBy');

        const scope = resolveSiteScope(actor);
        if (scope.mode === 'site') {
            qb.andWhere('ticket.siteId = :userSiteId', { userSiteId: scope.siteId });
        } else if (scope.mode === 'none') {
            qb.andWhere('1 = 0');
        }

        // Cross-site roles can optionally narrow further
        if (options.siteId && scope.mode === 'all') {
            qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
        }

        if (options.status) {
            qb.andWhere('ar.status = :status', { status: options.status });
        }

        return qb.orderBy('ar.createdAt', 'DESC').getMany();
    }

    async findAccessTypes(): Promise<AccessType[]> {
        return this.accessTypeRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
    }

    async findOne(id: string, actor: SiteActor): Promise<AccessRequest> {
        const accessRequest = await this.accessRequestRepo.findOne({
            where: { id },
            relations: ['ticket', 'ticket.user', 'accessType', 'verifiedBy'],
        });
        if (!accessRequest) {
            throw new NotFoundException('Access Request not found');
        }
        // Enforce site isolation BEFORE decrypting credentials (P0)
        assertSiteAccess(actor, accessRequest.ticket?.siteId);
        // Decrypt credentials on read so callers always receive plaintext.
        // `decrypt()` is backward-compatible with legacy plaintext rows.
        accessRequest.accessCredentials = this.cipher.decrypt(accessRequest.accessCredentials);
        return accessRequest;
    }

    async findByTicketId(ticketId: string, actor: SiteActor): Promise<AccessRequest | null> {
        const found = await this.accessRequestRepo.findOne({
            where: { ticketId },
            relations: ['ticket', 'accessType'],
        });
        if (found?.ticket) {
            assertSiteAccess(actor, found.ticket.siteId);
        }
        if (found?.accessCredentials) {
            found.accessCredentials = this.cipher.decrypt(found.accessCredentials);
        }
        return found;
    }

    /**
     * Internal loader: fetches with ticket + decrypts credentials.
     * Does NOT perform site access check — caller must assert if needed.
     */
    private async loadAccessRequestWithTicket(id: string): Promise<AccessRequest> {
        const accessRequest = await this.accessRequestRepo.findOne({
            where: { id },
            relations: ['ticket', 'ticket.user', 'accessType', 'verifiedBy'],
        });
        if (!accessRequest) {
            throw new NotFoundException('Access Request not found');
        }
        if (accessRequest.accessCredentials) {
            accessRequest.accessCredentials = this.cipher.decrypt(accessRequest.accessCredentials);
        }
        return accessRequest;
    }

    async markFormDownloaded(id: string, actor: SiteActor): Promise<AccessRequest> {
        const accessRequest = await this.loadAccessRequestWithTicket(id);
        assertSiteAccess(actor, accessRequest.ticket?.siteId);

        if (accessRequest.status !== AccessRequestStatus.FORM_PENDING) {
            throw new BadRequestException('Form already processed');
        }

        accessRequest.status = AccessRequestStatus.FORM_DOWNLOADED;
        accessRequest.formDownloadedAt = new Date();

        return this.accessRequestRepo.save(accessRequest);
    }

    async uploadSignedForm(id: string, filePath: string, actor: SiteActor): Promise<AccessRequest> {
        const accessRequest = await this.loadAccessRequestWithTicket(id);
        assertSiteAccess(actor, accessRequest.ticket?.siteId);

        if (accessRequest.status !== AccessRequestStatus.FORM_DOWNLOADED) {
            throw new BadRequestException('Please download the form first');
        }

        accessRequest.status = AccessRequestStatus.FORM_UPLOADED;
        accessRequest.signedFormUrl = filePath;
        accessRequest.signedFormUploadedAt = new Date();

        // Update ticket status
        await this.ticketRepo.update(accessRequest.ticketId, { status: TicketStatus.IN_PROGRESS });

        return this.accessRequestRepo.save(accessRequest);
    }

    async verify(id: string, agentId: string, dto: VerifyAccessRequestDto, actor: SiteActor): Promise<AccessRequest> {
        const accessRequest = await this.loadAccessRequestWithTicket(id);
        assertSiteAccess(actor, accessRequest.ticket?.siteId);

        if (accessRequest.status !== AccessRequestStatus.FORM_UPLOADED) {
            throw new BadRequestException('Form must be uploaded before verification');
        }

        accessRequest.status = AccessRequestStatus.VERIFIED;
        accessRequest.verifiedById = agentId;
        accessRequest.verifiedAt = new Date();
        accessRequest.verificationNotes = dto.verificationNotes;

        return this.accessRequestRepo.save(accessRequest);
    }

    async createAccess(id: string, agentId: string, dto: CreateAccessCredentialsDto, actor: SiteActor): Promise<AccessRequest> {
        const existing = await this.loadAccessRequestWithTicket(id);
        assertSiteAccess(actor, existing.ticket?.siteId);

        // P1 fix: accessRequest save + ticket status update were two
        // separate awaits. A crash between them left access granted but
        // the ticket still in IN_PROGRESS, blocking SLA breaches.
        const saved = await this.dataSource.transaction(async (manager) => {
            const accessRequest = await manager.findOne(AccessRequest, { where: { id } });
            if (!accessRequest) {
                throw new NotFoundException('Access request not found');
            }
            if (accessRequest.status !== AccessRequestStatus.VERIFIED) {
                throw new BadRequestException('Request must be verified first');
            }

            accessRequest.status = AccessRequestStatus.ACCESS_CREATED;
            accessRequest.accessCreatedAt = new Date();
            // P0 fix: credentials are encrypted at rest with AES-256-GCM
            accessRequest.accessCredentials = this.cipher.encrypt(dto.accessCredentials);

            await manager.update(Ticket, accessRequest.ticketId, {
                status: TicketStatus.RESOLVED,
                resolvedAt: new Date(),
            });

            return manager.save(AccessRequest, accessRequest);
        });

        this.eventEmitter.emit('access-request.completed', { accessRequest: saved });
        return saved;
    }

    async reject(id: string, agentId: string, dto: RejectAccessRequestDto, actor: SiteActor): Promise<AccessRequest> {
        const accessRequest = await this.loadAccessRequestWithTicket(id);
        assertSiteAccess(actor, accessRequest.ticket?.siteId);

        accessRequest.status = AccessRequestStatus.REJECTED;
        accessRequest.verifiedById = agentId;
        accessRequest.verifiedAt = new Date();
        accessRequest.verificationNotes = dto.rejectionReason;

        // Cancel ticket
        await this.ticketRepo.update(accessRequest.ticketId, { status: TicketStatus.CANCELLED });

        return this.accessRequestRepo.save(accessRequest);
    }

    // ==========================================
    // Access Type Template Management
    // ==========================================

    async updateAccessTypeFormTemplate(typeId: string, filePath: string): Promise<AccessType> {
        const accessType = await this.accessTypeRepo.findOne({ where: { id: typeId } });
        if (!accessType) {
            throw new NotFoundException('Access Type not found');
        }

        accessType.formTemplateUrl = filePath;
        return this.accessTypeRepo.save(accessType);
    }

    async getAccessTypeFormTemplate(typeId: string): Promise<{ id: string; name: string; formTemplateUrl: string | null; hasTemplate: boolean }> {
        const accessType = await this.accessTypeRepo.findOne({ where: { id: typeId } });
        if (!accessType) {
            throw new NotFoundException('Access Type not found');
        }

        return {
            id: accessType.id,
            name: accessType.name,
            formTemplateUrl: accessType.formTemplateUrl,
            hasTemplate: !!accessType.formTemplateUrl,
        };
    }

    async updateAccessType(
        typeId: string,
        userId: string,
        dto: {
            validityDays?: number;
            requiresSuperiorSignature?: boolean;
            requiresUserSignature?: boolean;
            description?: string;
            customFields?: any[];
        },
    ): Promise<AccessType> {
        const accessType = await this.accessTypeRepo.findOne({ where: { id: typeId } });
        if (!accessType) {
            throw new NotFoundException('Access Type not found');
        }

        const oldData = { ...accessType };

        if (dto.validityDays !== undefined) accessType.validityDays = dto.validityDays;
        if (dto.requiresSuperiorSignature !== undefined) accessType.requiresSuperiorSignature = dto.requiresSuperiorSignature;
        if (dto.requiresUserSignature !== undefined) accessType.requiresUserSignature = dto.requiresUserSignature;
        if (dto.description !== undefined) accessType.description = dto.description;
        if (dto.customFields !== undefined) accessType.customFields = dto.customFields;

        const saved = await this.accessTypeRepo.save(accessType);

        this.auditService.logAsync({
            userId,
            action: AuditAction.ACCESS_TYPE_UPDATE,
            entityType: 'AccessType',
            entityId: saved.id,
            description: `Updated access type: ${saved.name}`,
            oldValue: {
                validityDays: oldData.validityDays,
                requiresSuperiorSignature: oldData.requiresSuperiorSignature,
                requiresUserSignature: oldData.requiresUserSignature,
                description: oldData.description,
                customFields: oldData.customFields,
            },
            newValue: dto,
        });

        return saved;
    }
}

