import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard } from '../guards/hardware-role.guard';
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { HardwareCatalogService } from '../services/hardware-catalog.service';
import { CreateCatalogDto } from '../dto/create-catalog.dto';
import { UpdateCatalogDto } from '../dto/update-catalog.dto';

@Controller('hardware-requests/catalog')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareCatalogController {
    constructor(private readonly service: HardwareCatalogService) {}

    // Any authenticated user can view the catalog (needed by request form).
    @Get()
    async list(@Query('includeInactive') includeInactive?: string) {
        const data = includeInactive === 'true'
            ? await this.service.listAll()
            : await this.service.listActive();
        return { success: true, data };
    }

    @Get(':id')
    async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return { success: true, data: await this.service.getById(id) };
    }

    @Post()
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async create(@Body() dto: CreateCatalogDto) {
        return { success: true, data: await this.service.create(dto) };
    }

    @Patch(':id')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateCatalogDto,
    ) {
        return { success: true, data: await this.service.update(id, dto) };
    }

    @Delete(':id')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async remove(@Param('id', new ParseUUIDPipe()) id: string) {
        await this.service.remove(id);
        return { success: true };
    }
}
