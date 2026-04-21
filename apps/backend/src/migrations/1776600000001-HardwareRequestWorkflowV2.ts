import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardwareRequestWorkflowV21776600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // hardware_request_item — delivery tracking + per-item procurement decision
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD COLUMN IF NOT EXISTS delivery_status varchar(20) NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS arrived_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS procurement_decision varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS procurement_decided_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS procurement_decided_by uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD CONSTRAINT chk_hri_delivery_status
          CHECK (delivery_status IN ('PENDING','ARRIVED','NOT_PROCURED'))
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD CONSTRAINT chk_hri_procurement_decision
          CHECK (procurement_decision IS NULL OR procurement_decision IN ('APPROVED','REJECTED'))
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD CONSTRAINT fk_hri_decided_by
          FOREIGN KEY (procurement_decided_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hri_delivery_status
        ON hardware_request_item(delivery_status)
    `);

    // installation_schedule — proposed_slots + reschedule loop
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        ADD COLUMN IF NOT EXISTS proposed_slots jsonb NULL,
        ADD COLUMN IF NOT EXISTS selected_slot_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS reschedule_count int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reschedule_reason text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        DROP CONSTRAINT IF EXISTS installation_schedule_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        ADD CONSTRAINT installation_schedule_status_check
          CHECK (status IN (
            'PROPOSED','PROPOSED_AWAITING_USER','CONFIRMED',
            'IN_PROGRESS','DONE','RESCHEDULED','RESCHEDULE_REQUESTED','CANCELLED'
          ))
    `);

    // installation_schedule_items — M-to-N join
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS installation_schedule_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id uuid NOT NULL REFERENCES installation_schedule(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES hardware_request_item(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(schedule_id, item_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_isi_schedule
        ON installation_schedule_items(schedule_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_isi_item
        ON installation_schedule_items(item_id)
    `);

    // hardware_request status — extend untuk AWAITING_DELIVERY
    await queryRunner.query(`
      ALTER TABLE hardware_request
        DROP CONSTRAINT IF EXISTS hardware_request_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request
        ADD CONSTRAINT hardware_request_status_check
          CHECK (status IN (
            'DRAFT','SUBMITTED','REVIEW','APPROVED','PROCUREMENT',
            'AWAITING_DELIVERY','INSTALLATION','DONE','REJECTED','CANCELLED'
          ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS installation_schedule_items`);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        DROP COLUMN IF EXISTS proposed_slots,
        DROP COLUMN IF EXISTS selected_slot_at,
        DROP COLUMN IF EXISTS reschedule_count,
        DROP COLUMN IF EXISTS reschedule_reason
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        DROP CONSTRAINT IF EXISTS installation_schedule_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        ADD CONSTRAINT installation_schedule_status_check
          CHECK (status IN ('PROPOSED','CONFIRMED','IN_PROGRESS','DONE','RESCHEDULED','CANCELLED'))
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        DROP CONSTRAINT IF EXISTS fk_hri_decided_by,
        DROP CONSTRAINT IF EXISTS chk_hri_procurement_decision,
        DROP CONSTRAINT IF EXISTS chk_hri_delivery_status,
        DROP COLUMN IF EXISTS procurement_decided_by,
        DROP COLUMN IF EXISTS procurement_decided_at,
        DROP COLUMN IF EXISTS procurement_decision,
        DROP COLUMN IF EXISTS arrived_at,
        DROP COLUMN IF EXISTS delivery_status
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_hri_delivery_status`);
    await queryRunner.query(`
      ALTER TABLE hardware_request
        DROP CONSTRAINT IF EXISTS hardware_request_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request
        ADD CONSTRAINT hardware_request_status_check
          CHECK (status IN ('DRAFT','SUBMITTED','REVIEW','APPROVED','PROCUREMENT',
                            'INSTALLATION','DONE','REJECTED','CANCELLED'))
    `);
  }
}
