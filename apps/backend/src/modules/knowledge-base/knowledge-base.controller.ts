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
import { KnowledgeBaseService, ArticleFilters } from './knowledge-base.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleStatus } from './entities/article.entity';

@ApiTags('Knowledge Base')
@Controller('kb')
export class KnowledgeBaseController {
    constructor(private readonly kbService: KnowledgeBaseService) { }

    // ========== PUBLIC ENDPOINTS ==========

    @Get('articles')
    @ApiOperation({ summary: 'Get all articles or search' })
    @ApiQuery({ name: 'q', required: false, description: 'Search query' })
    @ApiQuery({ name: 'status', required: false, enum: ArticleStatus })
    @ApiQuery({ name: 'category', required: false })
    @ApiQuery({ name: 'all', required: false, description: 'Show all articles including drafts (for admin)' })
    async findAll(
        @Query('q') query?: string,
        @Query('status') status?: ArticleStatus,
        @Query('category') category?: string,
        @Query('all') showAll?: string,
    ) {
        // If showAll is not 'true', default to published articles only
        const effectiveStatus = showAll === 'true' ? status : (status || ArticleStatus.PUBLISHED);
        const filters: ArticleFilters = { query, status: effectiveStatus, category };
        return this.kbService.findAll(filters);
    }

    @Get('articles/popular')
    @ApiOperation({ summary: 'Get popular articles' })
    async getPopular(@Query('limit') limit?: number) {
        return this.kbService.getPopular(limit || 10);
    }

    @Get('articles/recent')
    @ApiOperation({ summary: 'Get recently updated articles' })
    async getRecent(@Query('limit') limit?: number) {
        return this.kbService.getRecent(limit || 10);
    }

    @Get('categories')
    @ApiOperation({ summary: 'Get all article categories' })
    async getCategories() {
        return this.kbService.getCategories();
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get knowledge base statistics' })
    async getStats() {
        return this.kbService.getStats();
    }

    @Get('articles/:id')
    @ApiOperation({ summary: 'Get article by ID' })
    async findOne(@Param('id') id: string) {
        return this.kbService.findOne(id);
    }

    @Post('articles/:id/helpful')
    @ApiOperation({ summary: 'Mark article as helpful' })
    async markHelpful(@Param('id') id: string) {
        return this.kbService.markHelpful(id);
    }

    @Post('articles/:id/view')
    @ApiOperation({ summary: 'Track article view' })
    async trackView(@Param('id') id: string) {
        return this.kbService.incrementViewCount(id);
    }

    // ========== PROTECTED ENDPOINTS (ADMIN/AGENT) ==========

    @Post('articles')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Create new article' })
    async create(@Body() createArticleDto: CreateArticleDto, @Request() req: any) {
        const authorId = req.user?.id;
        const authorName = req.user?.name || req.user?.email;
        return this.kbService.create(createArticleDto, authorId, authorName);
    }

    @Put('articles/:id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update article' })
    async update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
        return this.kbService.update(id, updateArticleDto);
    }

    @Patch('articles/:id/status')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update article status' })
    async updateStatus(@Param('id') id: string, @Body('status') status: ArticleStatus) {
        return this.kbService.updateStatus(id, status);
    }

    @Delete('articles/:id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Soft delete article' })
    async remove(@Param('id') id: string) {
        await this.kbService.remove(id);
        return { message: 'Article deleted successfully' };
    }

    @Post('articles/:id/restore')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Restore deleted article' })
    async restore(@Param('id') id: string) {
        return this.kbService.restore(id);
    }

    // ========== IMAGE UPLOAD ENDPOINTS ==========

    @Post('upload')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
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
        const baseUrl = process.env.API_URL || 'http://localhost:5050';
        return {
            url: `${baseUrl}/uploads/kb/${file.filename}`,
            filename: file.filename,
        };
    }

    @Post('upload/multiple')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
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
        const baseUrl = process.env.API_URL || 'http://localhost:5050';
        return {
            urls: files.map((file) => ({
                url: `${baseUrl}/uploads/kb/${file.filename}`,
                filename: file.filename,
            })),
        };
    }
}
