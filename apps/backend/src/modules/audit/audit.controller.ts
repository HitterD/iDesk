import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditService } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
    constructor(private readonly auditService: AuditService) {}

    @Get()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get audit logs' })
    @ApiQuery({ name: 'userId', required: false })
    @ApiQuery({ name: 'action', required: false, enum: AuditAction })
    @ApiQuery({ name: 'entityType', required: false })
    @ApiQuery({ name: 'entityId', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @Query('userId') userId?: string,
        @Query('action') action?: AuditAction,
        @Query('entityType') entityType?: string,
        @Query('entityId') entityId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.auditService.findAll({
            userId,
            action,
            entityType,
            entityId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page: page || 1,
            limit: limit || 50,
        });
    }

    @Get('entity/:entityType/:entityId')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get audit logs for a specific entity' })
    async findByEntity(
        @Param('entityType') entityType: string,
        @Param('entityId') entityId: string,
    ) {
        return this.auditService.findByEntity(entityType, entityId);
    }

    @Get('recent')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get recent activity' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getRecentActivity(@Query('limit') limit?: number) {
        return this.auditService.getRecentActivity(limit || 20);
    }
}
