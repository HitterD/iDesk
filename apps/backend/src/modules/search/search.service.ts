import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Article } from '../knowledge-base/entities/article.entity';
import { SavedSearch } from './entities/saved-search.entity';
import { CacheService } from '../../shared/core/cache';
import { 
    SearchFilterDto, 
    SearchQueryDto, 
    SearchScope 
} from './dto/search-filter.dto';
import { 
    SearchResultDto, 
    TicketSearchResult, 
    UserSearchResult, 
    ArticleSearchResult,
    SearchSuggestionDto,
} from './dto/search-result.dto';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Article)
        private readonly articleRepo: Repository<Article>,
        @InjectRepository(SavedSearch)
        private readonly savedSearchRepo: Repository<SavedSearch>,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Unified search across multiple entities
     */
    async search(dto: SearchQueryDto): Promise<SearchResultDto> {
        const startTime = Date.now();
        const { q: query, limit = 20, page = 1, ...filters } = dto;
        
        // Generate cache key
        const cacheKey = `search:${JSON.stringify(dto)}`;
        
        // Check cache
        const cached = await this.cacheService.get<SearchResultDto>(cacheKey);
        if (cached) {
            this.logger.debug(`Cache hit for search: ${query}`);
            return cached;
        }

        const scopes: SearchScope[] = filters.scope || ['tickets', 'users', 'articles'];
        const offset = (page - 1) * limit;
        
        const results: SearchResultDto = {
            tickets: [],
            users: [],
            articles: [],
            totalCount: 0,
            timing: 0,
            page,
            limit,
            hasMore: false,
        };

        // Run searches in parallel
        const searchPromises: Promise<void>[] = [];

        if (scopes.includes('tickets')) {
            searchPromises.push(
                this.searchTickets(query, filters, limit + 1, offset).then(r => {
                    results.tickets = r.slice(0, limit);
                    results.totalCount += r.length;
                    if (r.length > limit) results.hasMore = true;
                })
            );
        }

        if (scopes.includes('users')) {
            searchPromises.push(
                this.searchUsers(query, filters, limit + 1, offset).then(r => {
                    results.users = r.slice(0, limit);
                    results.totalCount += r.length;
                    if (r.length > limit) results.hasMore = true;
                })
            );
        }

        if (scopes.includes('articles')) {
            searchPromises.push(
                this.searchArticles(query, filters, limit + 1, offset).then(r => {
                    results.articles = r.slice(0, limit);
                    results.totalCount += r.length;
                    if (r.length > limit) results.hasMore = true;
                })
            );
        }

        await Promise.all(searchPromises);
        
        results.timing = Date.now() - startTime;
        
        // Cache for 60 seconds
        await this.cacheService.set(cacheKey, results, 60);
        
        this.logger.debug(`Search completed in ${results.timing}ms, found ${results.totalCount} results`);
        
        return results;
    }

    /**
     * Search tickets
     */
    private async searchTickets(
        query: string | undefined, 
        filters: SearchFilterDto, 
        limit: number,
        offset: number
    ): Promise<TicketSearchResult[]> {
        const qb = this.ticketRepo.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.assignedTo', 'agent')
            .leftJoinAndSelect('user.department', 'department');

        // Full-text search using ILIKE for basic search (PostgreSQL FTS can be added later)
        if (query && query.trim()) {
            const searchTerm = `%${query.trim().toLowerCase()}%`;
            qb.andWhere(new Brackets(qb => {
                qb.where('LOWER(ticket.ticketNumber) LIKE :search', { search: searchTerm })
                  .orWhere('LOWER(ticket.title) LIKE :search', { search: searchTerm })
                  .orWhere('LOWER(ticket.description) LIKE :search', { search: searchTerm });
            }));
        }

        // Apply filters
        if (filters.dateRange) {
            qb.andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
                startDate: new Date(filters.dateRange.start),
                endDate: new Date(filters.dateRange.end),
            });
        }

        if (filters.status?.length) {
            qb.andWhere('ticket.status IN (:...status)', { status: filters.status });
        }

        if (filters.priority?.length) {
            qb.andWhere('ticket.priority IN (:...priority)', { priority: filters.priority });
        }

        if (filters.assignedTo) {
            qb.andWhere('ticket.assignedToId = :assignedTo', { assignedTo: filters.assignedTo });
        }

        if (filters.department) {
            qb.andWhere('user.departmentId = :department', { department: filters.department });
        }

        if (filters.category) {
            qb.andWhere('ticket.category = :category', { category: filters.category });
        }

        if (filters.source) {
            qb.andWhere('ticket.source = :source', { source: filters.source });
        }

        qb.orderBy('ticket.createdAt', 'DESC')
          .skip(offset)
          .take(limit);

        const tickets = await qb.getMany();

        return tickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            createdAt: t.createdAt,
            userName: t.user?.fullName,
            assignedToName: t.assignedTo?.fullName,
            category: t.category,
            source: t.source,
            highlight: query ? this.extractHighlight(t.description, query) : undefined,
        }));
    }

    /**
     * Search users
     */
    private async searchUsers(
        query: string | undefined, 
        filters: SearchFilterDto, 
        limit: number,
        offset: number
    ): Promise<UserSearchResult[]> {
        const qb = this.userRepo.createQueryBuilder('user')
            .leftJoinAndSelect('user.department', 'department');

        if (query && query.trim()) {
            const searchTerm = `%${query.trim().toLowerCase()}%`;
            qb.andWhere(new Brackets(qb => {
                qb.where('LOWER(user.fullName) LIKE :search', { search: searchTerm })
                  .orWhere('LOWER(user.email) LIKE :search', { search: searchTerm })
                  .orWhere('LOWER(user.jobTitle) LIKE :search', { search: searchTerm });
            }));
        }

        if (filters.department) {
            qb.andWhere('user.departmentId = :department', { department: filters.department });
        }

        qb.orderBy('user.fullName', 'ASC')
          .skip(offset)
          .take(limit);

        const users = await qb.getMany();

        return users.map(u => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            department: u.department?.name,
            jobTitle: u.jobTitle,
            role: u.role,
            highlight: query ? this.extractHighlight(u.fullName + ' ' + u.email, query) : undefined,
        }));
    }

    /**
     * Search knowledge base articles
     */
    private async searchArticles(
        query: string | undefined, 
        filters: SearchFilterDto, 
        limit: number,
        offset: number
    ): Promise<ArticleSearchResult[]> {
        const qb = this.articleRepo.createQueryBuilder('article')
            .where('article.status = :status', { status: 'published' });

        if (query && query.trim()) {
            const searchTerm = `%${query.trim().toLowerCase()}%`;
            qb.andWhere(new Brackets(qb => {
                qb.where('LOWER(article.title) LIKE :search', { search: searchTerm })
                  .orWhere('LOWER(article.content) LIKE :search', { search: searchTerm });
            }));
        }

        if (filters.category) {
            qb.andWhere('article.category = :category', { category: filters.category });
        }

        if (filters.tags?.length) {
            // PostgreSQL array overlap check
            qb.andWhere('article.tags && ARRAY[:...tags]::varchar[]', { tags: filters.tags });
        }

        qb.orderBy('article.viewCount', 'DESC')
          .addOrderBy('article.createdAt', 'DESC')
          .skip(offset)
          .take(limit);

        const articles = await qb.getMany();

        return articles.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category,
            tags: a.tags,
            viewCount: a.viewCount || 0,
            createdAt: a.createdAt,
            highlight: query ? this.extractHighlight(a.content, query) : undefined,
        }));
    }

    /**
     * Get search suggestions (autocomplete)
     */
    async getSuggestions(query: string, limit = 10): Promise<SearchSuggestionDto[]> {
        if (!query || query.length < 2) return [];

        const cacheKey = `suggestions:${query.toLowerCase()}`;
        const cached = await this.cacheService.get<SearchSuggestionDto[]>(cacheKey);
        if (cached) return cached;

        const searchTerm = `%${query.toLowerCase()}%`;
        const suggestions: SearchSuggestionDto[] = [];

        // Ticket numbers and titles
        const tickets = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(['ticket.id', 'ticket.ticketNumber', 'ticket.title'])
            .where('LOWER(ticket.ticketNumber) LIKE :search', { search: searchTerm })
            .orWhere('LOWER(ticket.title) LIKE :search', { search: searchTerm })
            .take(5)
            .getMany();

        tickets.forEach(t => {
            suggestions.push({
                text: `${t.ticketNumber}: ${t.title}`,
                type: 'ticket',
                id: t.id,
            });
        });

        // User names
        const users = await this.userRepo
            .createQueryBuilder('user')
            .select(['user.id', 'user.fullName', 'user.email'])
            .where('LOWER(user.fullName) LIKE :search', { search: searchTerm })
            .take(3)
            .getMany();

        users.forEach(u => {
            suggestions.push({
                text: u.fullName,
                type: 'user',
                id: u.id,
            });
        });

        // Article titles
        const articles = await this.articleRepo
            .createQueryBuilder('article')
            .select(['article.id', 'article.title'])
            .where('article.status = :status', { status: 'published' })
            .andWhere('LOWER(article.title) LIKE :search', { search: searchTerm })
            .take(3)
            .getMany();

        articles.forEach(a => {
            suggestions.push({
                text: a.title,
                type: 'article',
                id: a.id,
            });
        });

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, suggestions.slice(0, limit), 300);

        return suggestions.slice(0, limit);
    }

    /**
     * Get saved searches for a user
     */
    async getSavedSearches(userId: string): Promise<SavedSearch[]> {
        return this.savedSearchRepo.find({
            where: { userId },
            order: { useCount: 'DESC', updatedAt: 'DESC' },
        });
    }

    /**
     * Save a search
     */
    async saveSearch(
        userId: string, 
        name: string, 
        query: string | undefined,
        filters: SearchFilterDto,
        description?: string
    ): Promise<SavedSearch> {
        const savedSearch = this.savedSearchRepo.create({
            userId,
            name,
            description,
            query,
            filters,
        });
        return this.savedSearchRepo.save(savedSearch);
    }

    /**
     * Delete a saved search
     */
    async deleteSavedSearch(userId: string, searchId: string): Promise<boolean> {
        const result = await this.savedSearchRepo.delete({ id: searchId, userId });
        return (result.affected || 0) > 0;
    }

    /**
     * Increment saved search use count
     */
    async useSavedSearch(userId: string, searchId: string): Promise<SavedSearch | null> {
        const search = await this.savedSearchRepo.findOne({
            where: { id: searchId, userId },
        });
        
        if (search) {
            search.useCount++;
            return this.savedSearchRepo.save(search);
        }
        
        return null;
    }

    /**
     * Extract highlight snippet from text
     */
    private extractHighlight(text: string | undefined, query: string, maxLength = 150): string | undefined {
        if (!text || !query) return undefined;
        
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) {
            return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
        }
        
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + query.length + 100);
        
        let highlight = text.slice(start, end);
        
        if (start > 0) highlight = '...' + highlight;
        if (end < text.length) highlight = highlight + '...';
        
        return highlight;
    }

    /**
     * Get popular/recent search terms (for analytics)
     */
    async getPopularSearches(limit = 10): Promise<string[]> {
        const searches = await this.savedSearchRepo
            .createQueryBuilder('search')
            .select('search.query')
            .where('search.query IS NOT NULL')
            .groupBy('search.query')
            .orderBy('COUNT(*)', 'DESC')
            .addOrderBy('MAX(search.updatedAt)', 'DESC')
            .take(limit)
            .getRawMany();

        return searches.map(s => s.search_query).filter(Boolean);
    }
}
