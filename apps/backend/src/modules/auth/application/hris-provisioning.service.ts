import { Injectable } from '@nestjs/common';
import { HrisEmployee, HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { User } from '../../users/entities/user.entity';

export interface HrisProvisioningPort {
    getEmployee(nik: string): Promise<HrisEmployee | null>;
    provisionEmployee(employee: HrisEmployee): Promise<User>;
}

export class HrisProvisioningResult {
    private constructor(public readonly user: User | undefined) {}

    static from(user: User | undefined): HrisProvisioningResult {
        return new HrisProvisioningResult(user);
    }
}

@Injectable()
export class HrisProvisioningService {
    constructor(
        private readonly hrisGateway: HrisGatewayAdapter,
        private readonly hrisSync: HrisSyncService,
    ) {}

    async provision(nik: string): Promise<User | undefined> {
        const employee: HrisEmployee | null = await this.hrisGateway.getEmployee(nik);
        if (!employee) return undefined;
        return this.hrisSync.provisionEmployee(employee);
    }
}
