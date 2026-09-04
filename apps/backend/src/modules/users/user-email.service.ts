import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

/**
 * Owns email changes made by the account holder.
 *
 * An email is a login credential (CredentialValidatorService resolves an
 * identifier containing "@" straight to a user), so a change here is treated as
 * a credential operation: the current password confirms it, and the result is
 * stamped as a human override so the HRIS sync and CSV import leave it alone.
 */
@Injectable()
export class UserEmailService {
    private readonly logger = new Logger(UserEmailService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly auditService: AuditService,
    ) {}

    async changeOwnEmail(
        userId: string,
        newEmail: string,
        currentPassword: string,
        request?: any,
    ): Promise<User> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        if (!user.password) {
            throw new BadRequestException('User does not have a password set');
        }

        const normalized = newEmail.trim().toLowerCase();
        if (normalized === user.email.toLowerCase()) {
            throw new BadRequestException('New email is the same as the current email');
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            throw new BadRequestException('Current password is incorrect');
        }

        // Checked before the write so the caller gets a 409 instead of a raw
        // unique-constraint violation from the "email" column.
        const taken = await this.userRepo.findOne({
            where: { email: normalized, id: Not(userId) },
        });
        if (taken) {
            throw new ConflictException('Email already exists');
        }

        const previousEmail = user.email;
        await this.userRepo.update(userId, {
            email: normalized,
            emailOverriddenAt: new Date(),
            emailOverriddenBy: userId,
        });

        this.auditService.logAsync({
            userId,
            action: AuditAction.USER_UPDATE,
            entityType: 'user',
            entityId: userId,
            oldValue: { email: maskEmail(previousEmail) },
            newValue: { email: maskEmail(normalized) },
            description: `User ${user.fullName} changed their own email`,
            request,
        });

        const updated = await this.userRepo.findOne({
            where: { id: userId },
            relations: ['department'],
        });
        if (!updated) {
            throw new NotFoundException('User not found');
        }
        return updated;
    }
}

/**
 * Audit rows are readable by admins, so the address is masked the same way
 * CredentialValidatorService masks it in login logs.
 */
function maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    return `${localPart.slice(0, 1)}***@${domain?.slice(0, 1) ?? '*'}***`;
}
