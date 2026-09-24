import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Memastikan keunikan NIK ("employeeId") pada tabel users untuk mencegah
 * akun duplikat atau bentrok identitas karyawan saat pairing perangkat SJA & SSO.
 *
 * Menggunakan partial unique index (WHERE "employeeId" IS NOT NULL) agar baris
 * yang belum memiliki NIK (NULL) tidak bertabrakan satu sama lain.
 */
export class AddUniqueIndexToUserEmployeeId1792200000000 implements MigrationInterface {
    name = 'AddUniqueIndexToUserEmployeeId1792200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Bersihkan whitespace di ujung string jika ada
        await queryRunner.query(`
            UPDATE "users"
            SET "employeeId" = btrim("employeeId")
            WHERE "employeeId" IS NOT NULL AND "employeeId" <> btrim("employeeId")
        `);

        // 2. Normalisasi string kosong menjadi NULL agar tidak dianggap sebagai satu NIK yang sama
        await queryRunner.query(`
            UPDATE "users"
            SET "employeeId" = NULL
            WHERE "employeeId" IS NOT NULL AND btrim("employeeId") = ''
        `);

        // 3. Buat partial unique index
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_employee_id_unique"
            ON "users" ("employeeId")
            WHERE "employeeId" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_employee_id_unique"`);
    }
}
