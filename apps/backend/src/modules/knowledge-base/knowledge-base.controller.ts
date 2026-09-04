import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';

// Ensure upload directory exists
const uploadDir = join(process.cwd(), 'uploads', 'kb');
if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
}
import { KnowledgeBaseService, ArticleFilters, ArticleSort } from './knowledge-base.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../shared/core/decorators/page-access.decorator';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleStatus } from './entities/article.entity';
import { allowedVisibilities, isInternalStaff } from './kb-visibility.util';
import { extractClientIp } from '../../shared/security/client-ip';

/** Sort values accepted by the list endpoint. Anything else falls back to the default. */
const ARTICLE_SORTS = ['popular', 'recent', 'newest', 'title'] as const;

const DEFAULT_PAGE_SIZE = 20;

/** Map a raw query value to a known sort, or undefined so the service applies its default. */
const parseSort = (value?: string): ArticleSort | undefined =>
    ARTICLE_SORTS.includes(value as ArticleSort) ? (value as ArticleSort) : undefined;

/** Parse a numeric query param, falling back when it is missing or not a number. */
const toPositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

@ApiTags('Knowledge Base')
@Controller('kb')
export class KnowledgeBaseController {
    constructor(private readonly kbService: KnowledgeBaseService) { }

    // ========== AUTHENTICATED READ ENDPOINTS ==========
    // Every read requires a session. Article visibility is derived from the
    // caller role on the server; it is never accepted from the request.

    @Get('articles')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get all articles or search' })
    @ApiQuery({ name: 'q', required: false, description: 'Search query' })
    @ApiQuery({ name: 'status', required: false, enum: ArticleStatus })
    @ApiQuery({ name: 'category', required: false })
    @ApiQuery({ name: 'all', required: false, description: 'Show all articles including drafts (ICT/agent staff only)' })
    @ApiQuery({ name: 'sort', required: false, enum: ARTICLE_SORTS, description: 'Ordering (default: newest)' })
    @ApiQuery({ name: 'limit', required: false, description: 'Page size. When set, the response is a paginated object instead of an array.' })
    @ApiQuery({ name: 'offset', required: false, description: 'Rows to skip (used with limit)' })
    @ApiQuery({ name: 'excludeFeatured', required: false, description: 'Omit the pinned article (it is rendered separately as a hero card)' })
    async findAll(
        @Request() req: any,
        @Query('q') query?: string,
        @Query('status') status?: ArticleStatus,
        @Query('category') category?: string,
        @Query('all') showAll?: string,
        @Query('sort') sort?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('excludeFeatured') excludeFeatured?: string,
    ) {
        // Drafts are unfinished internal material: only ICT/agent staff may list them.
        const canSeeDrafts = showAll === 'true' && isInternalStaff(req.user?.role);
        const effectiveStatus = canSeeDrafts ? status : (status || ArticleStatus.PUBLISHED);

        const filters: ArticleFilters = {
            query,
            status: effectiveStatus,
            category,
            visibilities: allowedVisibilities(req.user?.role),
            sort: parseSort(sort),
            excludeFeatured: excludeFeatured === 'true',
        };

        // Paginating is opt-in: without `limit` the response keeps its historic
        // array shape, which other screens (command palette, manage) rely on.
        if (limit === undefined) {
            return this.kbService.findAll(filters);
        }

        return this.kbService.findAllPaginated({
            ...filters,
            limit: toPositiveInt(limit, DEFAULT_PAGE_SIZE),
            offset: toPositiveInt(offset, 0),
        });
    }

    @Get('articles/featured')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get the pinned "start here" article, if any' })
    async getFeatured(@Request() req: any) {
        return this.kbService.findFeatured(allowedVisibilities(req.user?.role));
    }

    @Get('articles/popular')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get popular articles' })
    async getPopular(@Request() req: any, @Query('limit') limit?: number) {
        return this.kbService.getPopular(limit || 10, allowedVisibilities(req.user?.role));
    }

    @Get('articles/recent')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get recently updated articles' })
    async getRecent(@Request() req: any, @Query('limit') limit?: number) {
        return this.kbService.getRecent(limit || 10, allowedVisibilities(req.user?.role));
    }

    @Get('categories')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get all article categories' })
    async getCategories(@Request() req: any) {
        return this.kbService.getCategories(allowedVisibilities(req.user?.role));
    }

    @Get('stats')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get knowledge base statistics' })
    async getStats(@Request() req: any) {
        return this.kbService.getStats(allowedVisibilities(req.user?.role));
    }

    @Get('articles/:id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get article by ID' })
    async findOne(@Param('id') id: string, @Request() req: any) {
        return this.kbService.findOneForUser(id, req.user);
    }

    @Post('articles/:id/helpful')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Mark article as helpful' })
    async markHelpful(@Param('id') id: string, @Request() req: any) {
        await this.kbService.findOneForUser(id, req.user);
        return this.kbService.markHelpful(id);
    }

    @Get('articles/:id/viewers')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get recent viewers of an article' })
    async getViewers(@Param('id') id: string, @Request() req: any, @Query('limit') limit?: number) {
        await this.kbService.findOneForUser(id, req.user);
        return this.kbService.getViewers(id, limit ? Number(limit) : 50);
    }

    @Post('articles/:id/view')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Track unique article view' })
    async trackView(@Param('id') id: string, @Request() req: any) {
        await this.kbService.findOneForUser(id, req.user);

        // Viewer identity comes from the verified session only. Accepting it from
        // the request body would let any caller forge another user view record.
        const ip = extractClientIp(req);

        return this.kbService.incrementViewCount(id, {
            userId: req.user?.userId,
            fullName: req.user?.fullName,
            role: req.user?.role,
            ip: String(ip),
        });
    }

    // ========== PROTECTED ENDPOINTS (ADMIN/AGENT) ==========

    @Post('articles')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Create new article' })
    async create(@Body() createArticleDto: CreateArticleDto, @Request() req: any) {
        const authorId = req.user?.userId;
        const authorName = req.user?.fullName || req.user?.username;
        return this.kbService.create(createArticleDto, authorId, authorName, req.user?.role);
    }

    @Put('articles/:id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Update article' })
    async update(
        @Param('id') id: string,
        @Body() updateArticleDto: UpdateArticleDto,
        @Request() req: any,
    ) {
        return this.kbService.update(id, updateArticleDto, req.user?.userId, req.user?.role);
    }

    @Patch('articles/:id/status')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Update article status' })
    async updateStatus(@Param('id') id: string, @Body('status') status: ArticleStatus, @Request() req: any) {
        return this.kbService.updateStatus(id, status, req.user?.userId, req.user?.role);
    }

    @Patch('articles/:id/featured')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Pin or unpin the KB landing page "start here" article (admin only)' })
    async setFeatured(
        @Param('id') id: string,
        @Body('featured') featured: boolean,
        @Request() req: any,
    ) {
        return this.kbService.setFeatured(id, featured === true, req.user?.userId);
    }

    @Delete('articles/:id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Soft delete article' })
    async remove(@Param('id') id: string) {
        await this.kbService.remove(id);
        return { message: 'Article deleted successfully' };
    }

    @Post('articles/:id/restore')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Restore deleted article' })
    async restore(@Param('id') id: string) {
        return this.kbService.restore(id);
    }

    // ========== IMAGE UPLOAD ENDPOINTS ==========

    @Post('upload')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Upload single image for KB article' })
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: uploadDir,
                filename: (req, file, callback) => {
                    const uniqueSuffix = uuidv4();
                    const ext = extname(file.originalname);
                    callback(null, `kb-${uniqueSuffix}${ext}`);
                },
            }),
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
                    return callback(
                        new BadRequestException('Only image files are allowed!'),
                        false,
                    );
                }
                callback(null, true);
            },
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB
            },
        }),
    )
    uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        return {
            url: `/uploads/kb/${file.filename}`,
            filename: file.filename,
        };
    }

    @Post('upload/multiple')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @PageAccess('knowledge_base')
    @ApiOperation({ summary: 'Upload multiple images for KB article' })
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            storage: diskStorage({
                destination: uploadDir,
                filename: (req, file, callback) => {
                    const uniqueSuffix = uuidv4();
                    const ext = extname(file.originalname);
                    callback(null, `kb-${uniqueSuffix}${ext}`);
                },
            }),
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
                    return callback(
                        new BadRequestException('Only image files are allowed!'),
                        false,
                    );
                }
                callback(null, true);
            },
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB per file
            },
        }),
    )
    uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }
        return {
            urls: files.map((file) => ({
                url: `/uploads/kb/${file.filename}`,
                filename: file.filename,
            })),
        };
    }
}
