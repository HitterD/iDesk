import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IctBudgetRequest, IctBudgetRealizationStatus, IctBudgetRequestType } from './entities/ict-budget-request.entity';
import { Ticket, TicketType, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { CreateIctBudgetDto, ApproveIctBudgetDto, RealizeIctBudgetDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class IctBudgetService {
    constructor(
        @InjectRepository(IctBudgetRequest)
        private readonly ictBudgetRepo: Repository<IctBudgetRequest>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async create(userId: string, dto: CreateIctBudgetDto): Promise<IctBudgetRequest> {
        // Get user with site info
        const user = await this.userRepo.findOne({
            where: { id: userId },
            relations: ['department'],
        });
        if (!user) throw new NotFoundException('User not found');

        // Create ticket first
        const ticket = this.ticketRepo.create({
            title: dto.title || `ICT Budget Request: ${dto.itemName}`,
            description: dto.description || dto.justification,
            ticketType: TicketType.ICT_BUDGET,
            status: TicketStatus.TODO,
            priority: dto.urgencyLevel === 'URGENT' ? 'HIGH' : 'MEDIUM',
            category: 'ICT_BUDGET',
            userId: userId,
            siteId: user.siteId,
        });

        const savedTicket = await this.ticketRepo.save(ticket);

        // Create ICT Budget request
        const ictBudget = this.ictBudgetRepo.create({
            ticketId: savedTicket.id,
            requestType: dto.requestType,
            budgetCategory: dto.budgetCategory,
            itemName: dto.itemName,
            vendor: dto.vendor,
            estimatedAmount: dto.estimatedAmount,
            quantity: dto.quantity || 1,
            renewalPeriodMonths: dto.renewalPeriodMonths,
            currentExpiryDate: dto.currentExpiryDate ? new Date(dto.currentExpiryDate) : null,
            justification: dto.justification,
            urgencyLevel: dto.urgencyLevel,
            requiresInstallation: dto.requiresInstallation || false,
            realizationStatus: IctBudgetRealizationStatus.PENDING,
        });

        const saved = await this.ictBudgetRepo.save(ictBudget);

        // Emit event for notification
        this.eventEmitter.emit('ict-budget.created', { ictBudget: saved, ticket: savedTicket, user });

        return saved;
    }

    async findAll(options: { siteId?: string; status?: string } = {}): Promise<IctBudgetRequest[]> {
        const qb = this.ictBudgetRepo.createQueryBuilder('ict')
            .leftJoinAndSelect('ict.ticket', 'ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ict.superior', 'superior')
            .leftJoinAndSelect('ict.realizedBy', 'realizedBy');

        if (options.siteId) {
            qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
        }

        if (options.status) {
            qb.andWhere('ict.realizationStatus = :status', { status: options.status });
        }

        return qb.orderBy('ict.createdAt', 'DESC').getMany();
    }

    async findOne(id: string): Promise<IctBudgetRequest> {
        const ictBudget = await this.ictBudgetRepo.findOne({
            where: { id },
            relations: ['ticket', 'ticket.user', 'superior', 'realizedBy', 'linkedHwTicket'],
        });
        if (!ictBudget) {
            throw new NotFoundException('ICT Budget request not found');
        }
        return ictBudget;
    }

    async findByTicketId(ticketId: string): Promise<IctBudgetRequest | null> {
        return this.ictBudgetRepo.findOne({
            where: { ticketId },
            relations: ['ticket', 'superior', 'realizedBy'],
        });
    }

    async approve(id: string, superiorId: string, dto: ApproveIctBudgetDto): Promise<IctBudgetRequest> {
        const ictBudget = await this.findOne(id);

        if (ictBudget.realizationStatus !== IctBudgetRealizationStatus.PENDING) {
            throw new BadRequestException('Can only approve pending requests');
        }

        ictBudget.superiorId = superiorId;
        ictBudget.superiorApprovedAt = new Date();
        ictBudget.superiorNotes = dto.superiorNotes;
        ictBudget.realizationStatus = dto.approved
            ? IctBudgetRealizationStatus.APPROVED
            : IctBudgetRealizationStatus.REJECTED;

        const saved = await this.ictBudgetRepo.save(ictBudget);

        // Update ticket status
        if (dto.approved) {
            await this.ticketRepo.update(ictBudget.ticketId, { status: TicketStatus.IN_PROGRESS });
        } else {
            await this.ticketRepo.update(ictBudget.ticketId, { status: TicketStatus.CANCELLED });
        }

        // Emit event
        this.eventEmitter.emit('ict-budget.approved', { ictBudget: saved, approved: dto.approved });

        return saved;
    }

    async startPurchasing(id: string, agentId: string): Promise<IctBudgetRequest> {
        const ictBudget = await this.findOne(id);

        if (ictBudget.realizationStatus !== IctBudgetRealizationStatus.APPROVED) {
            throw new BadRequestException('Can only start purchasing approved requests');
        }

        ictBudget.realizationStatus = IctBudgetRealizationStatus.PURCHASING;
        ictBudget.realizedById = agentId;

        return this.ictBudgetRepo.save(ictBudget);
    }

    async realize(id: string, agentId: string, dto: RealizeIctBudgetDto): Promise<IctBudgetRequest> {
        const ictBudget = await this.findOne(id);

        if (ictBudget.realizationStatus !== IctBudgetRealizationStatus.PURCHASING) {
            throw new BadRequestException('Can only realize requests in purchasing status');
        }

        ictBudget.realizationStatus = IctBudgetRealizationStatus.REALIZED;
        ictBudget.realizedById = agentId;
        ictBudget.realizedAt = new Date();
        ictBudget.purchaseOrderNumber = dto.purchaseOrderNumber;
        ictBudget.invoiceNumber = dto.invoiceNumber;
        ictBudget.realizationNotes = dto.realizationNotes;

        const saved = await this.ictBudgetRepo.save(ictBudget);

        // If requires installation, create Hardware Installation ticket
        if (ictBudget.requiresInstallation) {
            const hwTicket = await this.createHardwareInstallationTicket(ictBudget);
            saved.linkedHwTicketId = hwTicket.id;
            await this.ictBudgetRepo.save(saved);
        }

        // Resolve original ticket
        await this.ticketRepo.update(ictBudget.ticketId, {
            status: TicketStatus.RESOLVED,
            resolvedAt: new Date(),
        });

        // Emit event
        this.eventEmitter.emit('ict-budget.realized', { ictBudget: saved });

        return saved;
    }

    private async createHardwareInstallationTicket(ictBudget: IctBudgetRequest): Promise<Ticket> {
        const originalTicket = await this.ticketRepo.findOne({
            where: { id: ictBudget.ticketId },
            relations: ['user'],
        });

        const hwTicket = this.ticketRepo.create({
            title: `Hardware Installation: ${ictBudget.itemName}`,
            description: `Hardware installation untuk ${ictBudget.itemName} dari ICT Budget Request #${originalTicket.ticketNumber}`,
            ticketType: TicketType.HARDWARE_INSTALLATION,
            status: TicketStatus.TODO,
            priority: 'HARDWARE_INSTALLATION',
            category: 'HARDWARE',
            userId: originalTicket.userId,
            siteId: originalTicket.siteId,
            isHardwareInstallation: true,
            hardwareType: ictBudget.budgetCategory,
        });

        return this.ticketRepo.save(hwTicket);
    }
}
