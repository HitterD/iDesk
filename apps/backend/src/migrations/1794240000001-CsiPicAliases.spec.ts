import { CsiPicAliases1794240000001 } from './1794240000001-CsiPicAliases';

describe('CsiPicAliases migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiPicAliases1794240000001()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds an empty, non-null aliases array to csi_pics (additive, idempotent)', async () => {
        expect(await run('up')).toBe('ALTER TABLE "csi_pics" ADD COLUMN IF NOT EXISTS "aliases" varchar(150)[] NOT NULL DEFAULT ARRAY[]::varchar[]');
    });

    it('drops the column on down', async () => {
        expect(await run('down')).toBe('ALTER TABLE "csi_pics" DROP COLUMN IF EXISTS "aliases"');
    });
});
