import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';

/**
 * The entire delete design rests on one property: TypeORM appends
 * "deletedAt IS NULL" to every repository select (QueryBuilder.js:544) and to
 * every join (SelectQueryBuilder.js:1008) — but only when the entity registers
 * a column with mode "deleteDate".
 *
 * If this ever fails, every read path in the app is exposing deleted tickets.
 * Treat it as a P0, not as a broken test.
 */
describe('Ticket soft-delete metadata', () => {
    const deleteDateColumns = () =>
        getMetadataArgsStorage().columns.filter(
            (c) => c.target === Ticket && c.mode === 'deleteDate',
        );

    it('registers exactly one delete date column', () => {
        expect(deleteDateColumns()).toHaveLength(1);
    });

    it('names that column deletedAt', () => {
        expect(deleteDateColumns()[0].propertyName).toBe('deletedAt');
    });
});
