import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    UseGuards,
    Request,
    ParseUUIDPipe,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { LostItemService } from './lost-item.service';
import { CreateLostItemDto, UpdateLostItemStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Lost Item')
@ApiBearerAuth()
@Controller('lost-item')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LostItemController {
    constructor(private readonly lostItemService: LostItemService) { }

    @Post()
    @ApiOperation({ summary: 'Create Lost Item report' })
    create(@Request() req: any, @Body() dto: CreateLostItemDto) {
        return this.lostItemService.create(req.user.userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all Lost Item reports' })
    @ApiQuery({ name: 'siteId', required: false })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(
        @Query('siteId') siteId?: string,
        @Query('status') status?: string,
    ) {
        return this.lostItemService.findAll({ siteId, status });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Lost Item report by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.lostItemService.findOne(id);
    }

    @Get('ticket/:ticketId')
    @ApiOperation({ summary: 'Get Lost Item report by ticket ID' })
    findByTicketId(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.lostItemService.findByTicketId(ticketId);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update Lost Item status' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLostItemStatusDto,
        @Request() req: any,
    ) {
        return this.lostItemService.updateStatus(id, dto, req.user.userId);
    }

    @Post(':id/police-report')
    @ApiOperation({ summary: 'Upload police report' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/police-reports',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
    }))
    uploadPoliceReport(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('reportNumber') reportNumber: string,
    ) {
        const filePath = `/uploads/police-reports/${file.filename}`;
        return this.lostItemService.uploadPoliceReport(id, filePath, reportNumber);
    }
}
