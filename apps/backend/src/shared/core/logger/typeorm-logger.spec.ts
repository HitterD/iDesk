import { Logger } from '@nestjs/common';
import { CustomTypeOrmLogger } from './typeorm-logger';

describe('CustomTypeOrmLogger credential redaction', () => {
    const CIPHER = 'enc(S3cret!x)';
    let sink: jest.SpyInstance;
    beforeEach(() => { sink = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined); jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
    afterEach(() => jest.restoreAllMocks());

    it('never prints parameters of a query on eform_credentials, even outside production', () => {
        const logger = new CustomTypeOrmLogger();
        logger.logQueryError('boom', 'INSERT INTO "eform_credentials" ("encryptedPassword") VALUES ($1)', [CIPHER]);
        logger.logQuerySlow(5000, 'UPDATE "eform_credentials" SET "encryptedPassword" = $1', [CIPHER]);
        expect(JSON.stringify([sink.mock.calls, (Logger.prototype.warn as jest.Mock).mock.calls])).not.toContain(CIPHER);
    });

    it('still prints parameters of other queries outside production', () => {
        const logger = new CustomTypeOrmLogger();
        logger.logQueryError('boom', 'SELECT * FROM "tickets" WHERE id = $1', ['t-1']);
        expect(JSON.stringify(sink.mock.calls)).toContain('t-1');
    });
});
