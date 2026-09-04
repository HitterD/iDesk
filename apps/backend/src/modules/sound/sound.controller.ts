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
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SoundService } from './sound.service';
import { CreateSoundDto, UpdateSoundDto, SetActiveSoundDto } from './dto';
import { NotificationEventType, normalizeNotificationEventType } from './entities/notification-sound.entity';
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
    findAll() {
        return this.soundService.findAll();
    }

    @Get('event-types')
    @ApiOperation({ summary: 'Get all event types with their active sounds' })
    getAllEventTypes() {
        return this.soundService.getAllEventTypes();
    }

    @Get('active/:eventType')
    @ApiOperation({ summary: 'Get active sound URL for event type' })
    getActiveSound(@Param('eventType') rawEventType: string) {
        const eventType = normalizeNotificationEventType(rawEventType);
        return this.soundService.getActiveSoundUrl(eventType);
    }

    @Get('by-event/:eventType')
    @ApiOperation({ summary: 'Get all sounds for an event type' })
    findByEventType(@Param('eventType') rawEventType: string) {
        const eventType = normalizeNotificationEventType(rawEventType);
        return this.soundService.findByEventType(eventType);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get sound by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.soundService.findOne(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new sound entry' })
    @Roles(UserRole.ADMIN)
    create(@Request() req: any, @Body() dto: CreateSoundDto) {
        return this.soundService.create(dto, req.user?.userId || req.user?.id);
    }

    @Post('upload')
    @ApiOperation({ summary: 'Upload custom sound file' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req, file, cb) => {
                const dir = './uploads/sounds';
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm', '.flac'];
            const ext = extname(file.originalname).toLowerCase();
            if (
                file.mimetype.startsWith('audio/') ||
                allowedExts.includes(ext) ||
                file.mimetype === 'application/octet-stream'
            ) {
                return cb(null, true);
            }
            cb(new BadRequestException('Only audio files (.mp3, .wav, .ogg, .m4a, .aac) are allowed'), false);
        },
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max
        },
    }))
    uploadSound(
        @Request() req: any,
        @UploadedFile() file: Express.Multer.File,
        @Body('eventType') rawEventType: string,
        @Body('name') name: string,
    ) {
        if (!file) {
            throw new BadRequestException('Audio file is required');
        }
        const eventType = normalizeNotificationEventType(rawEventType);
        const filePath = `/uploads/sounds/${file.filename}`;
        const soundName = name || file.originalname.replace(/\.[^/.]+$/, '');
        return this.soundService.uploadCustomSound(
            eventType,
            soundName,
            filePath,
            req.user?.userId || req.user?.id
        );
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
    setActiveSound(
        @Param('eventType') rawEventType: string,
        @Body() dto: SetActiveSoundDto,
    ) {
        const eventType = normalizeNotificationEventType(rawEventType);
        return this.soundService.setActiveSound(eventType, dto.soundId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete custom sound' })
    delete(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.soundService.delete(
            id,
            req.user?.userId || req.user?.id,
            req.user?.role
        );
    }
}
