import { AppDataSource } from "./src/data-source";

async function run() {
    await AppDataSource.initialize();
    
    try {
        await AppDataSource.query(`ALTER TYPE "hardware_requests_status_enum" ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRMATION'`);
        await AppDataSource.query(`ALTER TYPE "hardware_request_activities_fromstatus_enum" ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRMATION'`);
        await AppDataSource.query(`ALTER TYPE "hardware_request_activities_tostatus_enum" ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRMATION'`);
        console.log("Enums updated");
    } catch (e) {
        console.error("Enum error:", e.message);
    }

    // Add columns
    try {
        await AppDataSource.query(`ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "install_marked_done_at" TIMESTAMPTZ NULL`);
        console.log("Col 1 added");
    } catch (e) {
        console.error("Col 1 error:", e.message);
    }

    try {
        await AppDataSource.query(`ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "user_confirmed_at" TIMESTAMPTZ NULL`);
        console.log("Col 2 added");
    } catch (e) {
        console.error("Col 2 error:", e.message);
    }

    try {
        await AppDataSource.query(`ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "user_confirmation_kind" VARCHAR(16) NULL`);
        console.log("Col 3 added");
    } catch (e) {
        console.error("Col 3 error:", e.message);
    }

    process.exit(0);
}

run();
