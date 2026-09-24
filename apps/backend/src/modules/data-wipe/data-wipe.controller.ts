import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { DataWipeAccessGuard } from './guards/data-wipe-access.guard';
import { DataWipeService } from './data-wipe.service';
import { WIPE_CONFIRM_PHRASE, WipeExecuteDto, WipePreviewDto } from './dto/data-wipe.dto';
import { WIPE_DOMAIN_LABELS, WipeDomain } from './constants/wipe-scope.constants';

/**
 * Danger zone endpoints.
 *
 * Every method carries its own @Roles(ADMIN): RolesGuard allows a request when
 * no roles metadata is present, so relying on a class-level decorator alone
 * would leave a hole if a future method forgets one. DataWipeAccessGuard adds
 * the env flag and the email allowlist on top, and denies by default.
 */
@ApiTags('Data Wipe')
@Controller('admin/data-wipe')
@UseGuards(JwtAuthGuard, RolesGuard, DataWipeAccessGuard)
@ApiBearerAuth()
export class DataWipeController {
    constructor(private readonly dataWipeService: DataWipeService) { }

    /** Feature metadata for rendering the page before anything is selected. */
    @Get('status')
    @Roles(UserRole.ADMIN)
    getStatus() {
        return {
            enabled: true,
            confirmPhrase: WIPE_CONFIRM_PHRASE,
            wipeInProgress: this.dataWipeService.isWipeInProgress(),
            domains: Object.values(WipeDomain).map((domain) => ({
                key: domain,
                label: WIPE_DOMAIN_LABELS[domain],
            })),
        };
    }

    @Post('preview')
    @Roles(UserRole.ADMIN)
    async preview(@Body() dto: WipePreviewDto, @Request() req: any) {
        const preview = await this.dataWipeService.preview(dto.domains, req.user.userId);
        return { success: true, preview };
    }

    @Post('execute')
    @Roles(UserRole.ADMIN)
    async execute(@Body() dto: WipeExecuteDto, @Request() req: any) {
        const result = await this.dataWipeService.execute(
            dto.token,
            dto.confirmPhrase,
            req.user.userId,
            req,
        );
        return { success: true, result };
    }
}
