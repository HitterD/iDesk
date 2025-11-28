import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

/**
 * Ticket Repository - Handles all database operations for tickets
 * Follows Repository Pattern for clean separation of concerns
 */
@Injectable()
export class TicketRepository {
    constructor(
        @InjectRepository(Ticket)
        private readonly repo: Repository<Ticket>,
    ) {}

    /**
     * Find ticket with all relations loaded
     */
    async findWithRelations(id: string): Promise<Ticket | null> {
        return this.repo.findOne({
            where: { id },
            relations: ['user', 'user.department', 'assignedTo', 'messages', 'messages.sender'],
        });
    }

    /**
     * Find ticket by ID with specific relations
     */
    async findById(id: string, relations: string[] = []): Promise<Ticket | null> {
        return this.repo.findOne({
            where: { id },
            relations,
        });
    }

    /**
     * Find all tickets (role-based filtering)
     */
    async findAll(userId: string, role: UserRole): Promise<Ticket[]> {
        if (role === UserRole.ADMIN || role === UserRole.AGENT) {
            return this.repo.find({
                relations: ['user', 'user.department', 'assignedTo'],
                order: { createdAt: 'DESC' },
            });
        }
        return this.repo.find({
            where: { user: { id: userId } },
            relations: ['user', 'user.department', 'assignedTo'],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Find tickets with pagination and filtering
     */
    async findPaginated(
        userId: string,
        role: UserRole,
        options: PaginationOptions = {},
    ): Promise<PaginatedResult<Ticket>> {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            category,
            search,
        } = options;

        const qb = this.repo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo');

        // Role-based filtering
        if (role === UserRole.USER) {
            qb.where('ticket.userId = :userId', { userId });
        }

        // Status filter
        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }

        // Priority filter
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }

        // Category filter
        if (category) {
            qb.andWhere('ticket.category = :category', { category });
        }

        // Search
        if (search) {
            qb.andWhere(
                '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket.ticketNumber ILIKE :search)',
                { search: `%${search}%` },
            );
        }

        const total = await qb.getCount();

        // Sorting
        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        qb.orderBy(`ticket.${actualSortBy}`, sortOrder);

        // Pagination
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const data = await qb.getMany();
        const totalPages = Math.ceil(total / limit);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    /**
     * Find tickets by status
     */
    async findByStatus(status: TicketStatus): Promise<Ticket[]> {
        return this.repo.find({
            where: { status },
            relations: ['user', 'assignedTo'],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Count tickets created today
     */
    async countTodayTickets(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.repo.count({
            where: {
                createdAt: MoreThanOrEqual(today),
            },
        });
    }

    /**
     * Save ticket
     */
    async save(ticket: Ticket): Promise<Ticket> {
        return this.repo.save(ticket);
    }

    /**
     * Create ticket instance (not saved)
     */
    create(data: Partial<Ticket>): Ticket {
        return this.repo.create(data);
    }

    /**
     * Get repository for advanced queries
     */
    getRepository(): Repository<Ticket> {
        return this.repo;
    }
}
