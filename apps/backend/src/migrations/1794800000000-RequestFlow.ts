import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestFlow1794800000000 implements MigrationInterface {
    name = 'RequestFlow1794800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'HARDWARE_REQUEST'`,
        );
        await queryRunner.query(
            `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'EFORM_REQUEST'`,
        );
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "request_flows" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "ticketId" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
            "kind" varchar(16) NOT NULL,
            "hardwareRequestId" uuid REFERENCES "hardware_requests"("id"),
            "eformRequestId" uuid REFERENCES "eform_requests"("id"),
            "route" varchar(16),
            "managerId" uuid,
            "gmId" uuid,
            "hardwareSource" varchar(16),
            "reviewedById" uuid,
            "reviewedAt" timestamptz,
            "returnedReason" text,
            "rescheduleCount" int NOT NULL DEFAULT 0,
            "documentVersion" int NOT NULL DEFAULT 1,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
        )`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_request_flows_ticketId" ON "request_flows" ("ticketId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_request_flows_managerId" ON "request_flows" ("managerId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_request_flows_gmId" ON "request_flows" ("gmId")`,
        );
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "request_document_revisions" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "flowId" uuid NOT NULL REFERENCES "request_flows"("id") ON DELETE CASCADE,
            "version" int NOT NULL,
            "kind" varchar(8) NOT NULL,
            "label" varchar(200) NOT NULL,
            "actorId" uuid,
            "scanPath" varchar,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_request_document_revisions_flowId_version" UNIQUE ("flowId", "version")
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "request_document_revisions"');
        await queryRunner.query('DROP TABLE IF EXISTS "request_flows"');
        // Keep the enum values, as removing them would require replacing the type.
    }
}
