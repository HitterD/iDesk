import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { IpWhitelistService } from './ip-whitelist.service';
import { CreateIpWhitelistDto, UpdateIpWhitelistDto } from './dto';

@Controller('ip-whitelist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class IpWhitelistController {
    constructor(private readonly ipWhitelistService: IpWhitelistService) { }

    /**
     * Create a new IP whitelist entry
     */
    @Post()
    async create(@Body() dto: CreateIpWhitelistDto, @Request() req: any) {
        return this.ipWhitelistService.create(dto, req.user?.id);
    }

    /**
     * Get all whitelist entries
     */
    @Get()
    async findAll(@Query('includeInactive') includeInactive?: string) {
        return this.ipWhitelistService.findAll(includeInactive === 'true');
    }

    /**
     * Get whitelist statistics
     */
    @Get('stats')
    async getStats() {
        return this.ipWhitelistService.getStats();
    }

    /**
     * Test an IP address against the whitelist
     */
    @Get('test')
    async testIp(@Query('ip') ip: string) {
        if (!ip) {
            return { error: 'IP address is required' };
        }
        return this.ipWhitelistService.testIp(ip);
    }

    /**
     * Get a single whitelist entry
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.ipWhitelistService.findOne(id);
    }

    /**
     * Update a whitelist entry
     */
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateIpWhitelistDto, @Request() req: any) {
        return this.ipWhitelistService.update(id, dto, req.user?.id || req.user?.userId);
    }

    /**
     * Delete a whitelist entry
     */
    @Delete(':id')
    async remove(@Param('id') id: string, @Request() req: any) {
        const deleted = await this.ipWhitelistService.remove(id, req.user?.id || req.user?.userId);
        return { deleted };
    }
}
