import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { HARDWARE_ROLES_KEY } from './roles.decorator';
import { PermissionDeniedError } from '../domain/errors';

export function pickRole(user: any): HardwareRole {
    if (!user) return HardwareRole.USER;
    if (user.hardwareRole && Object.values(HardwareRole).includes(user.hardwareRole)) {
        return user.hardwareRole;
    }
    const roles: string[] = user.roles?.map((r: any) => r?.name ?? r) ?? [];
    const single: string | undefined = user.role;
    const all = [...roles, single].filter(Boolean) as string[];

    const ICT_TOKENS = new Set([
        'ADMIN', 'MANAGER', 'AGENT',
        'ICT_STAFF', 'ICT_MANAGER', 'ICT_STAFF', 'ICT_STAFF', 'ICT_STAFF',
        'PROCUREMENT', 'TECHNICIAN',
        'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN',
    ]);
    if (all.some((r) => ICT_TOKENS.has(r.toUpperCase()))) {
        return HardwareRole.ICT_STAFF;
    }
    return HardwareRole.USER;
}

@Injectable()
export class HardwareRoleGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(ctx: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<HardwareRole[]>(
            HARDWARE_ROLES_KEY,
            [ctx.getHandler(), ctx.getClass()],
        );
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        if (!user) throw new UnauthorizedException();

        const role = pickRole(user);
        req.hardwareRole = role; // for controllers to read

        if (!required || required.length === 0) return true;
        if (!required.includes(role)) {
            throw new PermissionDeniedError('access this resource');
        }
        return true;
    }
}
