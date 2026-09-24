import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
    COUNTER_RESETS,
    FORBIDDEN_TABLES,
    WipeDomain,
    buildWipePlan,
} from '../constants/wipe-scope.constants';

export interface WipeExecutionOutcome {
    deleted: Record<string, number>;
    totalRowsDeleted: number;
    countersReset: number;
}

/**
 * Performs the deletes inside a single transaction.
 *
 * The plan's order is load-bearing (RESTRICT chains and missing cascades), so
 * this service never reorders it — it executes it verbatim and lets Postgres
 * abort the whole transaction if a constraint is violated, leaving the database
 * exactly as it was.
 */
@Injectable()
export class WipeExecutorService {
    private readonly logger = new Logger(WipeExecutorService.name);

    constructor(private readonly dataSource: DataSource) { }

    async execute(domains: WipeDomain[]): Promise<WipeExecutionOutcome> {
        const plan = buildWipePlan(domains);
        const deleted: Record<string, number> = {};
        let totalRowsDeleted = 0;
        let countersReset = 0;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const spec of plan) {
                // Belt-and-braces: the plan builder already refuses protected
                // tables, but this is the last line before an irreversible DELETE.
                if (FORBIDDEN_TABLES.includes(spec.table)) {
                    throw new Error(`Menolak menghapus tabel yang dilindungi: ${spec.table}`);
                }

                const where = spec.where ? ` WHERE ${spec.where}` : '';
                const result = await queryRunner.query(
                    `WITH deleted AS (DELETE FROM "${spec.table}"${where} RETURNING 1)
                     SELECT COUNT(*)::int AS count FROM deleted`,
                );
                const count = Number(result?.[0]?.count ?? 0);
                deleted[spec.table] = count;
                totalRowsDeleted += count;
                this.logger.log(`Menghapus ${count} baris dari ${spec.table}`);
            }

            for (const counter of COUNTER_RESETS) {
                const result = await queryRunner.query(
                    `WITH updated AS (
                        UPDATE "${counter.table}" SET "${counter.column}" = 0
                        WHERE "${counter.column}" <> 0 RETURNING 1
                     )
                     SELECT COUNT(*)::int AS count FROM updated`,
                );
                const count = Number(result?.[0]?.count ?? 0);
                countersReset += count;
                this.logger.log(`Mereset ${count} counter pada ${counter.table}.${counter.column}`);
            }

            await queryRunner.commitTransaction();
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Wipe dibatalkan dan seluruh perubahan dikembalikan: ${error.message}`);
            throw error;
        } finally {
            await queryRunner.release();
        }

        return { deleted, totalRowsDeleted, countersReset };
    }
}
