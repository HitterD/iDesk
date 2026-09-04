import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HardwareRequestModule } from './hardware-request.module';
import { HardwareCatalog } from './domain/entities/hardware-catalog.entity';
import { HardwareRequest } from './domain/entities/hardware-request.entity';
import { HardwareRequestItem } from './domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from './domain/entities/hardware-request-activity.entity';
import { HardwareRequestComment } from './domain/entities/hardware-request-comment.entity';
import { InstallationSchedule } from './domain/entities/installation-schedule.entity';
import { HardwareAsset } from './domain/entities/hardware-asset.entity';
import { HardwareRequestCommandService } from './services/hardware-request-command.service';
import { ProcurementDecisionService } from './services/procurement-decision.service';
import { HardwareCatalogService } from './services/hardware-catalog.service';
import { InstallationScheduleService } from './services/installation-schedule.service';
import { HardwareAssetService } from './services/hardware-asset.service';
import { ItemCategory } from './domain/enums/item-category.enum';
import { RequestStatus } from './domain/enums/request-status.enum';
import { InstallStatus } from './domain/enums/install-status.enum';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

maybeDescribe('Mutual Scheduling Flow (integration)', () => {
    let app: TestingModule;
    let ds: DataSource;
    let commands: HardwareRequestCommandService;
    let catalog: HardwareCatalogService;
    let procurement: ProcurementDecisionService;
    let scheduleSvc: InstallationScheduleService;
    let assetSvc: HardwareAssetService;
    let userId: string;
    let leadId: string;
    let procId: string;
    let techId: string;
    let siteId: string;

    beforeAll(async () => {
        app = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    url: process.env.TEST_DATABASE_URL,
                    entities: [
                        HardwareCatalog, HardwareRequest, HardwareRequestItem,
                        HardwareRequestActivity, HardwareRequestComment,
                        InstallationSchedule, HardwareAsset, User, Site,
                    ],
                    synchronize: false,
                    dropSchema: false,
                }),
                HardwareRequestModule,
            ],
        }).compile();

        ds = app.get(DataSource);
        commands = app.get(HardwareRequestCommandService);
        catalog = app.get(HardwareCatalogService);
        procurement = app.get(ProcurementDecisionService);
        scheduleSvc = app.get(InstallationScheduleService);
        assetSvc = app.get(HardwareAssetService);

        const userRepo = ds.getRepository(User);
        const siteRepo = ds.getRepository(Site);
        userId = ((await userRepo.save(userRepo.create({ email: `user-${Date.now()}@test`, fullName: 'Test User' } as any))) as any).id;
        leadId = ((await userRepo.save(userRepo.create({ email: `lead-${Date.now()}@test`, fullName: 'Test Lead' } as any))) as any).id;
        procId = ((await userRepo.save(userRepo.create({ email: `proc-${Date.now()}@test`, fullName: 'Test Proc' } as any))) as any).id;
        techId = ((await userRepo.save(userRepo.create({ email: `tech-${Date.now()}@test`, fullName: 'Test Tech' } as any))) as any).id;
        siteId = ((await siteRepo.save(siteRepo.create({ name: `Test Site ${Date.now()}` } as any))) as any).id;
    });

    afterAll(async () => {
        await ds.destroy();
        await app.close();
    });

    it('runs end-to-end installation lifecycle', async () => {
        // Setup initial request and fast-forward to INSTALLATION
        const cat = await catalog.create({ code: `TEST-${Date.now()}`, name: 'Test Laptop', category: ItemCategory.LAPTOP } as any);
        const draft = await commands.createDraft(userId, siteId, 'AGENT' as any, {
            siteId, justification: 'Testing scheduling', items: [{ catalogId: cat.id, quantity: 1 }],
        } as any);
        await commands.submit(userId, draft.id);
        await commands.review(leadId, draft.id);
        const approved = await commands.approve(leadId, draft.id);
        const itemId = approved.items[0].id;
        await commands.updateItem(procId, draft.id, itemId, { actualCost: 15e6, vendor: 'Acme', invoiceNumber: 'A1' } as any);
        await procurement.decideItems(draft.id, { decisions: [{ itemId, decision: 'APPROVED' }] }, procId);
        const installationReq = await procurement.completeProcurement(draft.id, {}, procId);
        
        expect(installationReq.status).toBe(RequestStatus.AWAITING_DELIVERY);

        // Tech proposes schedule
        const start = new Date(Date.now() + 86400000).toISOString();
        const end = new Date(Date.now() + 90000000).toISOString();
        const sched = await scheduleSvc.propose(draft.id, {
            scheduledStart: start, scheduledEnd: end, technicianId: techId,
        }, { id: techId, role: 'ICT_STAFF' });
        expect(sched.status).toBe(InstallStatus.PROPOSED);

        // User confirms schedule
        const confirmed = await scheduleSvc.confirm(draft.id, { id: userId, role: 'USER' });
        expect(confirmed.status).toBe(InstallStatus.CONFIRMED);

        // Tech starts installation
        const inProg = await scheduleSvc.startInstallation(draft.id, { id: techId, role: 'ICT_STAFF' });
        expect(inProg.status).toBe(InstallStatus.IN_PROGRESS);

        // Tech scans barcode
        const asset = await assetSvc.createAsset(draft.id, itemId, `BC-${Date.now()}`, techId);
        expect(asset.id).toBeDefined();

        // Tech completes installation
        await scheduleSvc.completeInstallation(draft.id, { id: techId, role: 'ICT_STAFF' });
        const completedReq = await commands.completeInstallation(draft.id, { id: techId, role: 'ICT_STAFF' });
        expect(completedReq.status).toBe(RequestStatus.COMPLETED);
    });
});
