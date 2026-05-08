import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';

const TTL_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class InstallAutoConfirmCron {
    private readonly log = new Logger(InstallAutoConfirmCron.name);

    constructor(
        @InjectRepository(HardwareRequest) private readonly repo: Repository<HardwareRequest>,
        private readonly cmdSvc: HardwareRequestCommandService,
    ) {}

    @Cron('*/5 * * * *', { timeZone: 'Asia/Jakarta', name: 'hr-install-auto-confirm' })
    async run(): Promise<void> {
        const cutoff = new Date(Date.now() - TTL_MS);
        const rows = await this.repo.find({
            where: {
                status: RequestStatus.AWAITING_USER_CONFIRMATION,
                installMarkedDoneAt: LessThan(cutoff),
            },
            select: ['id'],
        });

        if (rows.length === 0) return;

        let ok = 0;
        let fail = 0;
        for (const r of rows) {
            try {
                await this.cmdSvc.autoConfirmInstallation(r.id, SYSTEM_ACTOR_ID);
                ok += 1;
            } catch (err) {
                fail += 1;
                this.log.error(`auto-confirm failed for request ${r.id}: ${(err as Error).message}`);
            }
        }
        this.log.log(`auto-confirm scan: total=${rows.length} ok=${ok} fail=${fail}`);
    }
}
