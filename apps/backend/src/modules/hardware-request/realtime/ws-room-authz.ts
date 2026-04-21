import { Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { pickRole } from '../guards/hardware-role.guard';

const ICT_ROLES: HardwareRole[] = [
    HardwareRole.ICT_LEAD,
    HardwareRole.ICT_PROCUREMENT,
    HardwareRole.ICT_TECHNICIAN,
];

export async function wsRoomAuthz(
    user: { id: string; roles: string[] },
    requestId: string,
    repo: Repository<HardwareRequest>,
): Promise<boolean> {
    const role = pickRole(user);
    if (ICT_ROLES.includes(role)) return true;

    const req = await repo.findOne({
        where: { id: requestId },
        select: ['id', 'requesterId'] as (keyof HardwareRequest)[],
    });
    return req?.requesterId === user.id;
}
