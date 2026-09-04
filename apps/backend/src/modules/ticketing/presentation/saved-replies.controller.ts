import { Controller, Get, Post, Patch, Put, Delete, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SavedRepliesService } from '../saved-replies.service';
import { CreateSavedReplyDto } from '../dto/create-saved-reply.dto';
import { UpdateSavedReplyDto } from '../dto/update-saved-reply.dto';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/user-role.enum';

@ApiTags('Saved Replies')
@Controller('saved-replies')
@UseGuards(JwtAuthGuard)
export class SavedRepliesController {
    constructor(private readonly savedRepliesService: SavedRepliesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new saved reply' })
    @ApiResponse({ status: 201, description: 'Saved reply created successfully.' })
    async create(@Request() req: any, @Body() createSavedReplyDto: CreateSavedReplyDto) {
        if (createSavedReplyDto.isGlobal && req.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only admins can create global saved replies.');
        }
        return this.savedRepliesService.create(req.user.userId, createSavedReplyDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all saved replies for current agent' })
    @ApiResponse({ status: 200, description: 'Return list of saved replies.' })
    async findAll(@Request() req: any) {
        return this.savedRepliesService.findAll(req.user.userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get single saved reply by ID' })
    async findOne(@Request() req: any, @Param('id') id: string) {
        return this.savedRepliesService.findOne(req.user.userId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing saved reply' })
    async update(
        @Request() req: any,
        @Param('id') id: string,
        @Body() updateSavedReplyDto: UpdateSavedReplyDto,
    ) {
        const isAdmin = req.user.role === UserRole.ADMIN;
        return this.savedRepliesService.update(req.user.userId, id, updateSavedReplyDto, isAdmin);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update an existing saved reply (PUT)' })
    async updatePut(
        @Request() req: any,
        @Param('id') id: string,
        @Body() updateSavedReplyDto: UpdateSavedReplyDto,
    ) {
        const isAdmin = req.user.role === UserRole.ADMIN;
        return this.savedRepliesService.update(req.user.userId, id, updateSavedReplyDto, isAdmin);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a saved reply' })
    async delete(@Request() req: any, @Param('id') id: string) {
        const isAdmin = req.user.role === UserRole.ADMIN;
        return this.savedRepliesService.delete(req.user.userId, id, isAdmin);
    }

    @Post('reset-defaults')
    @ApiOperation({ summary: 'Reset saved replies to system default templates for current agent' })
    async resetDefaults(@Request() req: any) {
        return this.savedRepliesService.resetDefaults(req.user.userId);
    }
}

