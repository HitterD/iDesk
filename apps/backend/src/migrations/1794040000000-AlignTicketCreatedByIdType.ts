import { MigrationInterface, QueryRunner } from 'typeorm';

/** Match the submitter join to the deployed user ID type (UUID or legacy varchar). */
export class AlignTicketCreatedByIdType1794040000000 implements MigrationInterface {
    name = 'AlignTicketCreatedByIdType1794040000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DO $$
            DECLARE
                user_type oid;
                creator_type oid;
            BEGIN
                SELECT atttypid INTO user_type FROM pg_attribute
                    WHERE attrelid = 'users'::regclass AND attname = 'id' AND NOT attisdropped;
                SELECT atttypid INTO creator_type FROM pg_attribute
                    WHERE attrelid = 'tickets'::regclass AND attname = 'createdById' AND NOT attisdropped;
                IF user_type IS NULL OR creator_type IS NULL THEN
                    RAISE EXCEPTION 'Cannot align tickets.createdById: required column missing';
                END IF;
                IF user_type NOT IN ('uuid'::regtype, 'varchar'::regtype)
                    OR creator_type NOT IN ('uuid'::regtype, 'varchar'::regtype) THEN
                    RAISE EXCEPTION 'Cannot align tickets.createdById: unsupported ID column type';
                END IF;
                IF user_type = creator_type THEN RETURN; END IF;
                BEGIN
                    IF user_type = 'uuid'::regtype THEN
                        ALTER TABLE tickets ALTER COLUMN "createdById" TYPE uuid USING "createdById"::uuid;
                    ELSE
                        ALTER TABLE tickets ALTER COLUMN "createdById" TYPE varchar USING "createdById"::varchar;
                    END IF;
                EXCEPTION WHEN invalid_text_representation THEN
                    RAISE EXCEPTION 'Cannot align tickets.createdById: invalid UUID values; no data changed';
                END;
            END $$`);
    }

    public async down(): Promise<void> {
        throw new Error('Forward-only repair: reverting createdById can break the users join');
    }
}
