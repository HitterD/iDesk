import { MigrationInterface, QueryRunner } from 'typeorm';

/** Personal ticket templates: a requester saves a filled form and reuses it with one click. */
export class AddUserTicketTemplates1794150000000 implements MigrationInterface {
    name = 'AddUserTicketTemplates1794150000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_ticket_templates" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "ticketType" varchar(30) NOT NULL,
            "label" varchar(40) NOT NULL,
            "title" varchar(200) NOT NULL,
            "description" text NOT NULL,
            "priority" varchar(20) NOT NULL,
            "category" varchar(100) NULL,
            "device" varchar(100) NULL,
            "software" varchar(100) NULL,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_ticket_templates_user_type" ON "user_ticket_templates" ("userId", "ticketType")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "user_ticket_templates"`);
    }
}
