import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1732900000000 implements MigrationInterface {
    name = 'AddPerformanceIndexes1732900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tickets table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets("assignedToId");
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets("userId");
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets("createdAt" DESC);
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_sla_target ON tickets("slaTarget");
        `);
        
        // Composite indexes for common queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status, priority);
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets("userId", status);
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status ON tickets("assignedToId", status);
        `);
        
        // Notifications table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications("userId", "isRead");
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications("createdAt" DESC);
        `);
        
        // Ticket messages index
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages("ticketId");
        `);
        
        // Audit logs index (if table exists)
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs("entityType", "entityId");
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("userId");
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs("createdAt" DESC);
                END IF;
            END $$;
        `);
        
        // Contracts/Renewals index (if table exists)
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contracts') THEN
                    CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts("endDate");
                    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
                END IF;
            END $$;
        `);

        console.log('Performance indexes created successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tickets indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_status;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_priority;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_assigned_to;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_user_id;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_created_at;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_sla_target;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_status_priority;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_user_status;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_assigned_status;`);
        
        // Drop notifications indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_user_read;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_created_at;`);
        
        // Drop ticket messages index
        await queryRunner.query(`DROP INDEX IF EXISTS idx_ticket_messages_ticket_id;`);
        
        // Drop audit logs indexes (if exists)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_entity;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_user;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_created_at;`);
        
        // Drop contracts indexes (if exists)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_contracts_end_date;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_contracts_status;`);
        
        console.log('Performance indexes dropped');
    }
}
