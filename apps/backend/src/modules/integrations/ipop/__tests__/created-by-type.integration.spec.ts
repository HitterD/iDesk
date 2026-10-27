import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import { DataSource, EntitySchema, QueryRunner, Repository } from 'typeorm';
import { AlignTicketCreatedByIdType1794040000000 } from '../../../../migrations/1794040000000-AlignTicketCreatedByIdType';
import { AddTicketCreatedBy1793200000000 } from '../../../../migrations/1793200000000-AddTicketCreatedBy';
import { ConfigService } from '@nestjs/config';
import { IPOP_SCOPE, IpopTicketService } from '../ipop-ticket.service';
import { Ticket } from '../../../ticketing/entities/ticket.entity';
import { User } from '../../../users/entities/user.entity';
import { TicketMessage } from '../../../ticketing/entities/ticket-message.entity';

config();
const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const USER_ID = '11111111-1111-4111-8111-111111111111';

describeDatabase('ticket createdBy PostgreSQL regression', () => {
    let db: DataSource;
    let runner: QueryRunner;
    let schema: string;

    beforeAll(async () => {
        db = await new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL }).initialize();
    });
    beforeEach(async () => {
        runner = db.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        schema = `created_by_test_${randomUUID().replace(/-/g, '')}`;
        await runner.query(`CREATE SCHEMA "${schema}"`);
        await runner.query(`SET LOCAL search_path TO "${schema}"`);
    });
    afterEach(async () => {
        await runner.rollbackTransaction();
        await runner.release();
    });
    afterAll(async () => { await db?.destroy(); });

    async function fixture(userType = 'uuid', userId = USER_ID) {
        await runner.query(`CREATE TABLE users (id ${userType} PRIMARY KEY)`);
        await runner.query(`CREATE TABLE tickets (id integer PRIMARY KEY)`);
        await new AddTicketCreatedBy1793200000000().up(runner);
        await runner.query('INSERT INTO users VALUES ($1)', [userId]);
        await runner.query('INSERT INTO tickets VALUES (1, $1), (2, NULL)', [userId]);
    }

    it('supports idempotent iPop and EBBK lookups through the real shared service', async () => {
        await fixture();
        await new AlignTicketCreatedByIdType1794040000000().up(runner);
        await runner.query(`ALTER TABLE tickets ADD "externalSource" varchar, ADD "externalRef" varchar,
            ADD "createdAt" timestamp DEFAULT now(), ADD "updatedAt" timestamp DEFAULT now()`);
        await runner.query(`UPDATE tickets SET "externalSource" = 'IPOP', "externalRef" = 'shared-ref' WHERE id = 1`);
        await runner.query(`INSERT INTO tickets (id, "createdById", "externalSource", "externalRef")
            VALUES (3, $1, 'EBBK', 'shared-ref')`, [USER_ID]);
        const user = new EntitySchema({ name: 'FixtureUser', tableName: 'users', schema,
            columns: { id: { type: 'uuid', primary: true } } });
        const ticket = new EntitySchema<any>({ name: 'FixtureTicket', tableName: 'tickets', schema,
            columns: { id: { type: Number, primary: true }, createdById: { type: 'uuid', nullable: true },
                externalSource: { type: String }, externalRef: { type: String },
                createdAt: { type: Date }, updatedAt: { type: Date } },
            relations: Object.fromEntries(['user', 'assignedTo', 'createdBy'].map((name) => [name, {
                type: 'many-to-one', target: 'FixtureUser', joinColumn: { name: 'createdById' },
            }])) });
        const orm = await new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL,
            entities: [user, ticket] }).initialize();
        try {
            const createTicket = jest.fn();
            const service = new IpopTicketService(
                orm.createEntityManager(runner).getRepository('FixtureTicket') as Repository<Ticket>,
                {} as Repository<User>, {} as Repository<TicketMessage>, {} as any,
                { createTicket } as any, new ConfigService(), {} as any,
            );
            const ebbk = { ...IPOP_SCOPE, source: 'EBBK', ownTicketsOnly: true };
            for (const [scope, id] of [[IPOP_SCOPE, 1], [ebbk, 3]] as const) {
                const found = await service.find({ externalRef: 'shared-ref' }, scope);
                expect(found).toHaveLength(1);
                expect(found[0].ticketId).toBe(id);
                const retry = await service.create({ externalRef: 'shared-ref' } as any, scope);
                expect(retry.created).toBe(false);
                expect(retry.ticket.ticketId).toBe(id);
                expect(await service.find({ externalRef: 'missing' }, scope)).toEqual([]);
            }
            expect(createTicket).not.toHaveBeenCalled();
        } finally { await orm.destroy(); }
    });

    it('preserves the index and is safe to run twice', async () => {
        await fixture();
        const migration = new AlignTicketCreatedByIdType1794040000000();
        await migration.up(runner);
        await migration.up(runner);
        const columns = await runner.query(`SELECT data_type, is_nullable FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = 'tickets' AND column_name = 'createdById'`, [schema]);
        expect(columns).toEqual([{ data_type: 'uuid', is_nullable: 'YES' }]);
        const indexes = await runner.query('SELECT indexname FROM pg_indexes WHERE schemaname = $1', [schema]);
        expect(indexes).toContainEqual({ indexname: 'IDX_tickets_createdById' });
    });

    it('preserves an existing foreign key on an already aligned schema', async () => {
        await fixture();
        await runner.query(`ALTER TABLE tickets ALTER COLUMN "createdById" TYPE uuid USING "createdById"::uuid`);
        await runner.query(`ALTER TABLE tickets ADD CONSTRAINT creator_fk FOREIGN KEY ("createdById")
            REFERENCES users(id) ON DELETE SET NULL`);
        await new AlignTicketCreatedByIdType1794040000000().up(runner);
        await runner.query('DELETE FROM users WHERE id = $1', [USER_ID]);
        expect(await runner.query(`SELECT "createdById" FROM tickets WHERE id = 1`))
            .toEqual([{ createdById: null }]);
    });

    it('preserves legacy varchar user IDs', async () => {
        await fixture('varchar', 'legacy-user');
        await new AlignTicketCreatedByIdType1794040000000().up(runner);
        expect(await runner.query(`SELECT u.id FROM tickets t JOIN users u ON u.id = t."createdById"`))
            .toEqual([{ id: 'legacy-user' }]);
    });

    it('rejects invalid UUID values without replacing them or changing the schema', async () => {
        await fixture();
        await runner.query(`UPDATE tickets SET "createdById" = 'invalid-user' WHERE id = 1`);
        await runner.query('SAVEPOINT before_repair');
        await expect(new AlignTicketCreatedByIdType1794040000000().up(runner))
            .rejects.toThrow('invalid UUID values; no data changed');
        await runner.query('ROLLBACK TO SAVEPOINT before_repair');
        expect(await runner.query(`SELECT "createdById" FROM tickets WHERE id = 1`))
            .toEqual([{ createdById: 'invalid-user' }]);
        const columns = await runner.query(`SELECT data_type FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = 'tickets' AND column_name = 'createdById'`, [schema]);
        expect(columns).toEqual([{ data_type: 'character varying' }]);
    });

    it('loads the submitter and preserves nulls instead of failing uuid = varchar', async () => {
        await fixture();
        await new AlignTicketCreatedByIdType1794040000000().up(runner);
        const rows = await runner.query(`SELECT t.id, u.id AS creator FROM tickets t
            LEFT JOIN users u ON u.id = t."createdById" ORDER BY t.id`);
        expect(rows).toEqual([{ id: 1, creator: USER_ID }, { id: 2, creator: null }]);
    });
});
