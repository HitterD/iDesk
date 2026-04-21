import { SetMetadata } from '@nestjs/common';
import { HardwareRole } from '../domain/enums/hardware-role.enum';

export const HARDWARE_ROLES_KEY = 'hardware_roles';
export const HardwareRoles = (...roles: HardwareRole[]) =>
    SetMetadata(HARDWARE_ROLES_KEY, roles);
