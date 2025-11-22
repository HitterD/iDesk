import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Knowledge Base')
@Controller('kb')
export class KnowledgeBaseController {
    constructor(private readonly kbService: KnowledgeBaseService) { }

    @Get('articles')
    @ApiOperation({ summary: 'Get all articles or search' })
    async findAll(@Query('q') query?: string) {
        return this.kbService.findAll(query);
    }

    @Get('articles/:id')
    @ApiOperation({ summary: 'Get article by ID' })
    async findOne(@Param('id') id: string) {
        return this.kbService.findOne(id);
    }

    @Post('articles')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Create new article' })
    async create(@Body() createArticleDto: any) {
        return this.kbService.create(createArticleDto);
    }
}
