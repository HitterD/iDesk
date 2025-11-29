import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    UseInterceptors,
    UploadedFile,
    Req,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
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
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MULTER_OPTIONS, UPLOAD_RATE_LIMITS } from '../../shared/core/config/upload.config';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Return current user profile.' })
    async getProfile(@Req() req) {
        const userId = req.user.userId;
        return this.usersService.findById(userId);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update own profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
    async updateProfile(@Req() req, @Body() updateUserDto: UpdateUserDto) {
        const userId = req.user.userId;
        return this.usersService.update(userId, updateUserDto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Change password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully.' })
    async changePassword(
        @Req() req,
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
    async uploadAvatar(@Req() req, @UploadedFile() file: Express.Multer.File) {
        const userId = req.user.userId;
        const avatarUrl = `/uploads/avatars/${file.filename}`;
        return this.usersService.updateAvatar(userId, avatarUrl, file.path);
    }

    @Get('agents')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get all agents' })
    @ApiResponse({ status: 200, description: 'Return all agents.' })
    async getAgents() {
        return this.usersService.getAgents();
    }

    @Get('agents/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get agent performance statistics' })
    @ApiResponse({ status: 200, description: 'Return agent stats with ticket counts.' })
    async getAgentStats() {
        return this.usersService.getAgentStats();
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'Return all users.' })
    async findAll() {
        return this.usersService.getAllUsers();
    }

    @Post('import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Throttle({ default: UPLOAD_RATE_LIMITS.import })
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.csv))
    @ApiOperation({ summary: 'Import users from CSV' })
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
    async importUsers(@UploadedFile() file: Express.Multer.File) {
        return this.usersService.importUsers(file);
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

    @Post(':id/reset-password')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 resets per minute
    @ApiOperation({ summary: 'Reset user password (Admin/Agent)' })
    @ApiResponse({ status: 200, description: 'Password reset successfully.' })
    async resetUserPassword(
        @Param('id') userId: string,
        @Body() body: { newPassword: string },
    ) {
        return this.usersService.resetPassword(userId, body.newPassword);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Delete a user (Admin only)' })
    @ApiResponse({ status: 200, description: 'User deleted successfully.' })
    async deleteUser(@Param('id') userId: string, @Req() req) {
        return this.usersService.deleteUser(userId, req.user.userId);
    }
}
