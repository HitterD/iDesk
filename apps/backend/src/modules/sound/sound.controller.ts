import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { SoundService } from './sound.service';
import { CreateSoundDto, UpdateSoundDto, SetActiveSoundDto } from './dto';
import { NotificationEventType } from './entities/notification-sound.entity';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Sound')
@ApiBearerAuth()
@Controller('sounds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SoundController {
    constructor(private readonly soundService: SoundService) { }

    @Get()
    @ApiOperation({ summary: 'Get all notification sounds' })
    @Roles(UserRole.ADMIN)
    findAll() {
        return this.soundService.findAll();
    }

    @Get('event-types')
    @ApiOperation({ summary: 'Get all event types with their active sounds' })
    @Roles(UserRole.ADMIN)
    getAllEventTypes() {
        return this.soundService.getAllEventTypes();
    }

    @Get('active/:eventType')
    @ApiOperation({ summary: 'Get active sound URL for event type' })
    getActiveSound(@Param('eventType') eventType: NotificationEventType) {
        return this.soundService.getActiveSoundUrl(eventType);
    }

    @Get('by-event/:eventType')
    @ApiOperation({ summary: 'Get all sounds for an event type' })
    @Roles(UserRole.ADMIN)
    findByEventType(@Param('eventType') eventType: NotificationEventType) {
        return this.soundService.findByEventType(eventType);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get sound by ID' })
    @Roles(UserRole.ADMIN)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.soundService.findOne(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new sound entry' })
    @Roles(UserRole.ADMIN)
    create(@Request() req: any, @Body() dto: CreateSoundDto) {
        return this.soundService.create(dto, req.user.userId);
    }

    @Post('upload')
    @ApiOperation({ summary: 'Upload custom sound file' })
    @ApiConsumes('multipart/form-data')
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/sounds',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            // Only allow audio files
            if (!file.mimetype.startsWith('audio/')) {
                return cb(new Error('Only audio files are allowed'), false);
            }
            cb(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max
        },
    }))
    uploadSound(
        @Request() req: any,
        @UploadedFile() file: Express.Multer.File,
        @Body('eventType') eventType: NotificationEventType,
        @Body('name') name: string,
    ) {
        const filePath = `/uploads/sounds/${file.filename}`;
        return this.soundService.uploadCustomSound(eventType, name, filePath, req.user.userId);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update sound' })
    @Roles(UserRole.ADMIN)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSoundDto,
    ) {
        return this.soundService.update(id, dto);
    }

    @Post('set-active/:eventType')
    @ApiOperation({ summary: 'Set active sound for event type' })
    @Roles(UserRole.ADMIN)
    setActiveSound(
        @Param('eventType') eventType: NotificationEventType,
        @Body() dto: SetActiveSoundDto,
    ) {
        return this.soundService.setActiveSound(eventType, dto.soundId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete custom sound' })
    @Roles(UserRole.ADMIN)
    delete(@Param('id', ParseUUIDPipe) id: string) {
        return this.soundService.delete(id);
    }
}
