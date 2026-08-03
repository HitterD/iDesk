import { Injectable, Logger } from '@nestjs/common';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserCrudService } from './user-crud.service';
import { UserImportService } from './user-import.service';
import { UserPasswordService } from './user-password.service';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private readonly userCrudService: UserCrudService,
        private readonly userImportService: UserImportService,
        private readonly userPasswordService: UserPasswordService,
    ) { }

    async createAgent(dto: CreateAgentDto, createdByUserId?: string): Promise<User> {
        return this.userCrudService.createAgent(dto, createdByUserId);
    }

    async findAll(options: any = {}) {
        return this.userCrudService.findAll(options);
    }

    async update(userId: string, updateData: any): Promise<User> {
        return this.userCrudService.update(userId, updateData);
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
        return this.userPasswordService.changePassword(userId, currentPassword, newPassword);
    }

    async updateRole(userId: string, role: UserRole): Promise<User> {
        return this.userCrudService.updateRole(userId, role);
    }

    async setCurrentRefreshToken(refreshToken: string, userId: string) {
        return this.userPasswordService.setCurrentRefreshToken(refreshToken, userId);
    }

    async removeRefreshToken(userId: string) {
        return this.userPasswordService.removeRefreshToken(userId);
    }

    async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
        return this.userPasswordService.getUserIfRefreshTokenMatches(refreshToken, userId);
    }

    async importUsers(file: Express.Multer.File, upsert = false): Promise<any> {
        return this.userImportService.importUsers(file, upsert);
    }

    async generateImportTemplate(): Promise<{ data: Buffer; filename: string }> {
        return this.userImportService.generateImportTemplate();
    }

    async createUser(dto: CreateUserDto, createdByUserId?: string): Promise<User> {
        return this.userCrudService.createUser(dto, createdByUserId);
    }

    async updateAvatar(userId: string, avatarUrl: string, filePath: string): Promise<User> {
        return this.userCrudService.updateAvatar(userId, avatarUrl, filePath);
    }

    async findById(id: string): Promise<User | undefined> {
        return this.userCrudService.findById(id);
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userCrudService.findByEmail(email);
    }

    async findByEmployeeId(employeeId: string): Promise<User | undefined> {
        return this.userCrudService.findByEmployeeId(employeeId);
    }

    async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
        return this.userPasswordService.updatePassword(userId, newPasswordHash);
    }

    async resetPassword(userId: string, newPassword: string, callerId?: string, callerRole?: string): Promise<{ success: boolean; message: string }> {
        return this.userPasswordService.resetPassword(userId, newPassword, callerId, callerRole);
    }

    async getAgents(siteId?: string, callerRole?: UserRole, category?: string, ticketType?: string): Promise<User[]> {
        return this.userCrudService.getAgents(siteId, callerRole, category, ticketType);
    }

    async getAllUsers(): Promise<User[]> {
        return this.userCrudService.getAllUsers();
    }

    async getApprovers(excludeId?: string): Promise<User[]> {
        return this.userCrudService.getApprovers(excludeId);
    }

    async deleteUser(userId: string, adminId: string): Promise<{ success: boolean; message: string }> {
        return this.userCrudService.deleteUser(userId, adminId);
    }

    async getAgentStats(options?: { search?: string; siteCode?: string; role?: string }): Promise<any> {
        return this.userCrudService.getAgentStats(options);
    }

    async updateUserByAdmin(userId: string, updateData: any, adminId?: string): Promise<User> {
        return this.userCrudService.updateUserByAdmin(userId, updateData, adminId);
    }

    async toggleUserStatus(userId: string, isActive: boolean, adminId?: string): Promise<{ success: boolean; message: string; user: User }> {
        return this.userCrudService.toggleUserStatus(userId, isActive, adminId);
    }

    async exportUsers(fields: string[] = []): Promise<{ data: string; filename: string }> {
        return this.userImportService.exportUsers(fields);
    }

    async exportUsersXlsx(siteFilter: string = 'ALL', fields: string[] = []): Promise<Buffer> {
        return this.userImportService.exportUsersXlsx(siteFilter, fields);
    }

    async bulkDeleteUsers(userIds: string[], adminId: string): Promise<{ success: boolean; deleted: number; errors: string[] }> {
        return this.userCrudService.bulkDeleteUsers(userIds, adminId);
    }

    async bulkUpdateStatus(userIds: string[], isActive: boolean): Promise<{ success: boolean; updated: number }> {
        return this.userCrudService.bulkUpdateStatus(userIds, isActive);
    }

    async getTechnicians(): Promise<Array<{ id: string; fullName: string }>> {
        return this.userCrudService.getTechnicians();
    }
}
