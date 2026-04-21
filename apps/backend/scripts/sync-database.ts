/**
 * Database Sync Script
 * 
 * This script manually synchronizes the database schema with all entities.
 * Run this when you encounter "relation does not exist" errors.
 * 
 * Usage: npx ts-node -r tsconfig-paths/register scripts/sync-database.ts
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Import all entities
import { User } from '../src/modules/users/entities/user.entity';
import { Ticket } from '../src/modules/ticketing/entities/ticket.entity';
import { TicketMessage } from '../src/modules/ticketing/entities/ticket-message.entity';
import { CustomerSession } from '../src/modules/users/entities/customer-session.entity';
import { Department } from '../src/modules/users/entities/department.entity';
import { SlaConfig } from '../src/modules/ticketing/entities/sla-config.entity';
import { SavedReply } from '../src/modules/ticketing/entities/saved-reply.entity';
import { TicketSurvey } from '../src/modules/ticketing/entities/ticket-survey.entity';
import { TicketTemplate } from '../src/modules/ticketing/entities/ticket-template.entity';
import { AuditLog } from '../src/modules/audit/entities/audit-log.entity';
import { TicketAttribute } from '../src/modules/ticketing/entities/ticket-attribute.entity';
import { TelegramSession } from '../src/modules/telegram/entities/telegram-session.entity';
import { Article } from '../src/modules/knowledge-base/entities/article.entity';
import { ArticleView } from '../src/modules/knowledge-base/entities/article-view.entity';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { NotificationPreference } from '../src/modules/notifications/entities/notification-preference.entity';
import { NotificationLog } from '../src/modules/notifications/entities/notification-log.entity';
import { SavedSearch } from '../src/modules/search/entities/saved-search.entity';
import { RenewalContract } from '../src/modules/renewal/entities/renewal-contract.entity';
import { BusinessHours } from '../src/modules/sla-config/entities/business-hours.entity';
import { WorkflowRule } from '../src/modules/automation/entities/workflow-rule.entity';
import { WorkflowExecution } from '../src/modules/automation/entities/workflow-execution.entity';
import { SystemSettings } from '../src/modules/settings/entities/system-settings.entity';
import { Site } from '../src/modules/sites/entities/site.entity';

import { LostItemReport } from '../src/modules/lost-item/entities/lost-item-report.entity';
import { AccessType } from '../src/modules/access-request/entities/access-type.entity';
import { AccessRequest } from '../src/modules/access-request/entities/access-request.entity';
import { PriorityWeight } from '../src/modules/workload/entities/priority-weight.entity';
import { AgentDailyWorkload } from '../src/modules/workload/entities/agent-daily-workload.entity';
import { NotificationSound } from '../src/modules/sound/entities/notification-sound.entity';
import { BackupConfiguration } from '../src/modules/synology/entities/backup-configuration.entity';
import { BackupHistory } from '../src/modules/synology/entities/backup-history.entity';
import { IpWhitelist } from '../src/modules/ip-whitelist/entities/ip-whitelist.entity';
import { ZoomAccount } from '../src/modules/zoom-booking/entities/zoom-account.entity';
import { ZoomBooking } from '../src/modules/zoom-booking/entities/zoom-booking.entity';
import { ZoomMeeting } from '../src/modules/zoom-booking/entities/zoom-meeting.entity';
import { ZoomParticipant } from '../src/modules/zoom-booking/entities/zoom-participant.entity';
import { ZoomSettings } from '../src/modules/zoom-booking/entities/zoom-settings.entity';
import { ZoomAuditLog } from '../src/modules/zoom-booking/entities/zoom-audit-log.entity';
import { FeatureDefinition } from '../src/modules/permissions/entities/feature-definition.entity';
import { UserFeaturePermission } from '../src/modules/permissions/entities/user-feature-permission.entity';
import { PermissionPreset } from '../src/modules/permissions/entities/permission-preset.entity';
import { SpreadsheetConfig } from '../src/modules/google-sync/entities/spreadsheet-config.entity';
import { SpreadsheetSheet } from '../src/modules/google-sync/entities/spreadsheet-sheet.entity';
import { SyncLog } from '../src/modules/google-sync/entities/sync-log.entity';
import { VpnAccess } from '../src/modules/vpn-access/entities/vpn-access.entity';

async function syncDatabase() {
    console.log('🔄 Starting database synchronization...');
    console.log('');
    console.log('📊 Database Configuration:');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.DB_PORT || '5432'}`);
    console.log(`   Database: ${process.env.DB_DATABASE || 'idesk_db'}`);
    console.log(`   Username: ${process.env.DB_USERNAME || 'postgres'}`);
    console.log('');

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'idesk_db',
        entities: [
            User, Ticket, TicketMessage, CustomerSession, Department, SlaConfig,
            SavedReply, TicketSurvey, TicketTemplate, TicketAttribute, Article,
            ArticleView, Notification, NotificationPreference, NotificationLog,
            TelegramSession, SavedSearch, RenewalContract, AuditLog, BusinessHours,
            WorkflowRule, WorkflowExecution, SystemSettings,
            Site, LostItemReport, AccessType, AccessRequest,
            PriorityWeight, AgentDailyWorkload, NotificationSound,
            BackupConfiguration, BackupHistory,
            IpWhitelist,
            ZoomAccount, ZoomBooking, ZoomMeeting, ZoomParticipant, ZoomSettings, ZoomAuditLog,
            FeatureDefinition, UserFeaturePermission, PermissionPreset,
            SpreadsheetConfig, SpreadsheetSheet, SyncLog,
            VpnAccess,
        ],
        synchronize: true, // This will create/update all tables
        logging: true,
    });

    try {
        console.log('🔌 Connecting to database...');
        await dataSource.initialize();
        console.log('✅ Connected successfully!');
        console.log('');
        console.log('📋 Synchronizing schema...');
        await dataSource.synchronize();
        console.log('');
        console.log('✅ Database schema synchronized successfully!');
        console.log('');

        // List all tables
        const tables = await dataSource.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        console.log(`📊 Created/Updated ${tables.length} tables:`);
        tables.forEach((t: { table_name: string }) => {
            console.log(`   - ${t.table_name}`);
        });

        await dataSource.destroy();
        console.log('');
        console.log('🎉 Done! You can now restart your backend server.');

    } catch (error) {
        console.error('');
        console.error('❌ Error synchronizing database:');
        console.error(error.message);
        console.error('');

        if (error.message.includes('database') && error.message.includes('does not exist')) {
            console.error('💡 Tip: The database does not exist. Please create it first:');
            console.error('   1. Open pgAdmin or psql');
            console.error('   2. Run: CREATE DATABASE idesk_db;');
            console.error('   3. Then run this script again');
        } else if (error.message.includes('connect ECONNREFUSED')) {
            console.error('💡 Tip: Cannot connect to PostgreSQL. Please ensure:');
            console.error('   1. PostgreSQL service is running');
            console.error('   2. The host and port in .env are correct');
        } else if (error.message.includes('password authentication failed')) {
            console.error('💡 Tip: Wrong password. Please check your .env file:');
            console.error('   - DB_USERNAME');
            console.error('   - DB_PASSWORD');
        }

        process.exit(1);
    }
}

syncDatabase();
