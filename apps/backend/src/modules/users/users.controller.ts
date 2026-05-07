import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    UseInterceptors,
    UploadedFile,
    Req,
    Res,
    Patch,
    Param,
    Delete,
    Query,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPaginationDto } from './dto/user-pagination.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { MULTER_OPTIONS, UPLOAD_RATE_LIMITS } from '../../shared/core/config/upload.config';
import { CacheService } from '../../shared/core/cache/cache.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly cacheService: CacheService,
    ) { }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Return current user profile.' })
    async getProfile(@Req() req: any) {
        const userId = req.user.userId;
        return this.usersService.findById(userId);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update own profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
    async updateProfile(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
        const userId = req.user.userId;
        return this.usersService.update(userId, updateUserDto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Change password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully.' })
    async changePassword(
        @Req() req: any,
        @Body() body: { currentPassword: string; newPassword: string },
    ) {
        const userId = req.user.userId;
        return this.usersService.changePassword(userId, body.currentPassword, body.newPassword);
    }

    @Post('agents')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a new agent' })
    @ApiResponse({ status: 201, description: 'The agent has been successfully created.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createAgent(@Body() createAgentDto: CreateAgentDto) {
        return this.usersService.createAgent(createAgentDto);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a new user (Admin)' })
    @ApiResponse({ status: 201, description: 'User created successfully.' })
    async createUser(@Body() createUserDto: CreateUserDto) {
        return this.usersService.createUser(createUserDto);
    }

    @Post('avatar')
    @UseGuards(JwtAuthGuard)
    @Throttle({ default: UPLOAD_RATE_LIMITS.avatar })
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.avatar))
    @ApiOperation({ summary: 'Upload user avatar' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, description: 'Avatar uploaded successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid file type or size.' })
    async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
        const userId = req.user.userId;
        const avatarUrl = `/uploads/avatars/${file.filename}`;
        return this.usersService.updateAvatar(userId, avatarUrl, file.path);
    }

    @Get('agents')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get agents, optionally filtered by siteId' })
    @ApiQuery({ name: 'siteId', required: false, description: 'Filter agents by site ID' })
    @ApiResponse({ status: 200, description: 'Return agents.' })
    async getAgents(@Query('siteId') siteId?: string) {
        return this.usersService.getAgents(siteId);
    }

    @Get('agents/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get agent performance statistics' })
    @ApiResponse({ status: 200, description: 'Return agent stats with ticket counts.' })
    async getAgentStats() {
        return this.usersService.getAgentStats();
    }

    @Get('technicians')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get all technicians for dropdowns' })
    @ApiResponse({ status: 200, description: 'Return list of technician {id, fullName}.' })
    async getTechnicians() {
        return this.usersService.getTechnicians();
    }

    @Get('approvers')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get all active users for approval selection, optionally excluding a user by ID' })
    @ApiQuery({ name: 'exclude', required: false, description: 'User ID to exclude (e.g. current requester)' })
    async getApprovers(@Query('exclude') excludeId?: string) {
        return this.usersService.getApprovers(excludeId);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get all users with pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 200)' })
    @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
    @ApiQuery({ name: 'siteCode', required: false, description: 'Filter by site code (SPJ, SMG, KRW, JTB)' })
    @ApiQuery({ name: 'role', required: false, enum: ['ADMIN', 'AGENT', 'USER'], description: 'Filter by role' })
    @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (fullName, email, createdAt, role)' })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
    @ApiResponse({ status: 200, description: 'Return paginated users.' })
    async findAll(@Query() query: UserPaginationDto) {
        return this.usersService.findAll(query);
    }

    @Post('import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Throttle({ default: UPLOAD_RATE_LIMITS.import })
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.csv))
    @ApiOperation({ summary: 'Import users from CSV. Pass ?upsert=true to update existing users.' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Users imported successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid file type or size.' })
    async importUsers(
        @UploadedFile() file: Express.Multer.File,
        @Query('upsert') upsert?: string,
    ) {
        return this.usersService.importUsers(file, upsert === 'true');
    }


    @Get('import-template')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Download import template XLSX' })
    @ApiResponse({ status: 200, description: 'Template XLSX file.' })
    async getImportTemplate(@Res() res: Response) {
        const template = await this.usersService.generateImportTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${template.filename}`);
        return res.send(template.data);
    }

    @Get('export')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Export users to CSV or XLSX' })
    @ApiResponse({ status: 200, description: 'Users exported.' })
    async exportUsers(
        @Query('format') format: 'csv' | 'xlsx' = 'csv',
        @Query('site') site: string = 'ALL',
        @Query('fields') fields: string = '',
        @Res() res: Response,
    ) {
        const fieldList = fields ? fields.split(',').map(f => f.trim()).filter(Boolean) : [];
        if (format === 'xlsx') {
            const buffer = await this.usersService.exportUsersXlsx(site, fieldList);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=users_${site}_${new Date().toISOString().split('T')[0]}.xlsx`);
            return res.send(buffer);
        }
        return this.usersService.exportUsers(fieldList);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update user details (Admin)' })
    @ApiResponse({ status: 200, description: 'User updated successfully.' })
    async updateUser(
        @Param('id') userId: string,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        return this.usersService.updateUserByAdmin(userId, updateUserDto);
    }

    @Patch(':id/role')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update user role' })
    @ApiResponse({ status: 200, description: 'User role updated.' })
    async updateRole(
        @Param('id') userId: string,
        @Body('role') role: UserRole,
    ) {
        return this.usersService.updateRole(userId, role);
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Toggle user active status' })
    @ApiResponse({ status: 200, description: 'User status updated.' })
    async toggleUserStatus(
        @Param('id') userId: string,
        @Body('isActive') isActive: boolean,
    ) {
        return this.usersService.toggleUserStatus(userId, isActive);
    }

    @Post(':id/reset-password')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 resets per minute
    @ApiOperation({ summary: 'Reset user password (Admin/Agent)' })
    @ApiResponse({ status: 200, description: 'Password reset successfully.' })
    async resetUserPassword(
        @Param('id') userId: string,
        @Body() body: { newPassword: string },
        @Req() req: any,
    ) {
        return this.usersService.resetPassword(userId, body.newPassword, req.user.userId, req.user.role);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Delete a user (Admin only)' })
    @ApiResponse({ status: 200, description: 'User deleted successfully.' })
    async deleteUser(@Param('id') userId: string, @Req() req: any) {
        return this.usersService.deleteUser(userId, req.user.userId);
    }

    @Post('bulk-delete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Delete multiple users' })
    @ApiResponse({ status: 200, description: 'Users deleted successfully.' })
    async bulkDeleteUsers(@Body('userIds') userIds: string[], @Req() req: any) {
        return this.usersService.bulkDeleteUsers(userIds, req.user.userId);
    }

    @Post('bulk-status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update status for multiple users' })
    @ApiResponse({ status: 200, description: 'User statuses updated.' })
    async bulkUpdateStatus(
        @Body('userIds') userIds: string[],
        @Body('isActive') isActive: boolean,
    ) {
        return this.usersService.bulkUpdateStatus(userIds, isActive);
    }

    /**
     * POST /users/:id/unlock-lockout
     * Clear the PageAccessGuard access-denial lockout for a specific user.
     * Admins use this to immediately restore access for users locked out due to
     * repeated 403 denials (e.g. from a prior misconfiguration).
     */
    @Post(':id/unlock-lockout')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Clear page-access lockout for a user (Admin only)' })
    @ApiResponse({ status: 200, description: 'Lockout cleared.' })
    async unlockUserLockout(@Param('id') userId: string) {
        const lockoutKey = `accessLockout:${userId}`;
        const denialKey = `accessDenials:${userId}`;
        await Promise.all([
            this.cacheService.delAsync(lockoutKey),
            this.cacheService.delAsync(denialKey),
        ]);
        return { success: true, message: `Lockout cleared for user ${userId}` };
    }
}

