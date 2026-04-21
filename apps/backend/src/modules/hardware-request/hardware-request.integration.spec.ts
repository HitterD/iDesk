import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HardwareRequestModule } from './hardware-request.module';
import { HardwareCatalog } from './domain/entities/hardware-catalog.entity';
import { HardwareRequest } from './domain/entities/hardware-request.entity';
import { HardwareRequestItem } from './domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from './domain/entities/hardware-request-activity.entity';
import { HardwareRequestComment } from './domain/entities/hardware-request-comment.entity';
import { HardwareRequestCommandService } from './services/hardware-request-command.service';
import { ProcurementDecisionService } from './services/procurement-decision.service';
import { HardwareRequestQueryService } from './services/hardware-request-query.service';
import { HardwareCatalogService } from './services/hardware-catalog.service';
import { HardwareCommentService } from './services/hardware-comment.service';
import { ItemCategory } from './domain/enums/item-category.enum';
import { RequestStatus } from './domain/enums/request-status.enum';
import { HardwareRole } from './domain/enums/hardware-role.enum';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

maybeDescribe('HardwareRequest happy path (integration)', () => {
    let app: TestingModule;
    let ds: DataSource;
    let commands: HardwareRequestCommandService;
    let procurement: ProcurementDecisionService;
    let queries: HardwareRequestQueryService;
    let catalog: HardwareCatalogService;
    let comments: HardwareCommentService;
    let userId: string;
    let leadId: string;
    let procId: string;
    let siteId: string;

    beforeAll(async () => {
        app = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    url: process.env.TEST_DATABASE_URL,
                    entities: [
                        HardwareCatalog, HardwareRequest, HardwareRequestItem,
                        HardwareRequestActivity, HardwareRequestComment, User, Site,
                    ],
                    synchronize: false,
                    dropSchema: false,
                }),
                HardwareRequestModule,
            ],
        }).compile();

        ds = app.get(DataSource);
        commands = app.get(HardwareRequestCommandService);
        procurement = app.get(ProcurementDecisionService);
        queries = app.get(HardwareRequestQueryService);
        catalog = app.get(HardwareCatalogService);
        comments = app.get(HardwareCommentService);

        // Prepare test users + site via direct inserts
        const userRepo = ds.getRepository(User);
        const siteRepo = ds.getRepository(Site);
        userId = ((await userRepo.save(userRepo.create({
            email: `user-${Date.now()}@test`, fullName: 'Test User',
        } as any))) as any).id;
        leadId = ((await userRepo.save(userRepo.create({
            email: `lead-${Date.now()}@test`, fullName: 'Test Lead',
        } as any))) as any).id;
        procId = ((await userRepo.save(userRepo.create({
            email: `proc-${Date.now()}@test`, fullName: 'Test Proc',
        } as any))) as any).id;
        siteId = ((await siteRepo.save(siteRepo.create({
            name: `Test Site ${Date.now()}`,
        } as any))) as any).id;
    });

    afterAll(async () => {
        await ds.destroy();
        await app.close();
    });

    it('runs DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PROCUREMENT → INSTALLATION', async () => {
        const cat = await catalog.create({
            code: `TEST-${Date.now()}`, name: 'Test Laptop', category: ItemCategory.LAPTOP,
        } as any);

        const draft = await commands.createDraft(userId, {
            siteId, justification: 'Integration test journey end to end',
            items: [{ catalogId: cat.id, quantity: 1 }],
        } as any);
        expect(draft.status).toBe(RequestStatus.DRAFT);

        const submitted = await commands.submit(userId, draft.id);
        expect(submitted.status).toBe(RequestStatus.SUBMITTED);

        const reviewed = await commands.review(leadId, draft.id);
        expect(reviewed.status).toBe(RequestStatus.UNDER_REVIEW);

        const approved = await commands.approve(leadId, draft.id);
        expect(approved.status).toBe(RequestStatus.APPROVED);

        const itemId = approved.items[0].id;
        const procured = await commands.updateItem(procId, draft.id, itemId, {
            actualCost: 15000000, vendor: 'Acme', invoiceNumber: 'INV-1',
        } as any);
        expect(procured.status).toBe(RequestStatus.PROCUREMENT);

        await procurement.decideItems(draft.id, { decisions: [{ itemId, decision: 'APPROVED' }] }, procId);
        const complete = await procurement.completeProcurement(draft.id, {}, procId);
        expect(complete.status).toBe(RequestStatus.AWAITING_DELIVERY);

        // Comment by user
        const c1 = await comments.add(
            { id: userId, role: HardwareRole.USER }, draft.id, { body: 'Thanks!' },
        );
        expect(c1.body).toBe('Thanks!');

        // Query from user scope shows it
        const list = await queries.list(
            { id: userId, role: HardwareRole.USER }, { page: 1, pageSize: 10 } as any,
        );
        expect(list.rows.map((r) => r.id)).toContain(draft.id);
    });
});
