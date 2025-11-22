import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SavedRepliesService } from '../saved-replies.service';
import { CreateSavedReplyDto } from '../dto/create-saved-reply.dto';
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
    async create(@Request() req, @Body() createSavedReplyDto: CreateSavedReplyDto) {
        if (createSavedReplyDto.isGlobal && req.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only admins can create global saved replies.');
        }
        return this.savedRepliesService.create(req.user.userId, createSavedReplyDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all saved replies (Global + Personal)' })
    @ApiResponse({ status: 200, description: 'Return list of saved replies.' })
    async findAll(@Request() req) {
        return this.savedRepliesService.findAll(req.user.userId);
    }
}
