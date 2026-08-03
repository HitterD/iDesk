import { SeedRoleScopedPresets1784505600000 } from '../../../migrations/1784505600000-SeedRoleScopedPresets';

describe('SeedRoleScopedPresets1784505600000', () => {
    it('repairs missing preset names from existing preset IDs without replacing the IDs', async () => {
        const queries: string[] = [];
        const queryRunner = {
            query: jest.fn(async (query: string) => queries.push(query)),
        };

        await new SeedRoleScopedPresets1784505600000().up(queryRunner as never);

        expect(queries).toContainEqual(expect.stringContaining(`
            UPDATE "users" AS user_record
            SET "appliedPresetName" = preset.name
            FROM "permission_presets" AS preset
            WHERE user_record."appliedPresetId" = preset.id
              AND user_record."appliedPresetName" IS NULL
        `));
    });
});
