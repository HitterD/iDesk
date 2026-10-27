import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DatabaseExceptionFilter } from './database-exception.filter';

describe('DatabaseExceptionFilter', () => {
    const uniqueViolation = (detail: string) =>
        new QueryFailedError('INSERT ...', [], Object.assign(new Error('duplicate key'), { code: '23505', detail }));

    const run = (exception: QueryFailedError) => {
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const host = {
            switchToHttp: () => ({
                getResponse: () => ({ status }),
                getRequest: () => ({ url: '/v1/hardware-requests', method: 'POST', correlationId: 'test-correlation' }),
            }),
        } as unknown as ArgumentsHost;
        new DatabaseExceptionFilter().catch(exception, host);
        return { statusCode: status.mock.calls[0][0], body: json.mock.calls[0][0] };
    };

    it('correlates a database type mismatch without logging query parameters', () => {
        const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        try {
            const error = new QueryFailedError('SELECT secret-query', ['secret-parameter'],
                Object.assign(new Error('operator does not exist: uuid = character varying'), { code: '42883' }));
            const { statusCode, body } = run(error);
            expect(statusCode).toBe(500);
            expect(body.correlationId).toBe('test-correlation');
            expect(log).toHaveBeenCalledWith(expect.objectContaining({
                message: 'DATABASE_REQUEST_FAILED', correlationId: 'test-correlation', sqlState: '42883',
            }));
            expect(JSON.stringify(log.mock.calls)).not.toContain('secret-parameter');
            expect(JSON.stringify(log.mock.calls)).not.toContain('secret-query');
        } finally { log.mockRestore(); }
    });

    it('names a snake_case column in a duplicate-key message', () => {
        const { statusCode, body } = run(uniqueViolation('Key (employee_id)=(12345) already exists.'));

        expect(statusCode).toBe(HttpStatus.CONFLICT);
        expect(body.message).toBe('Employee Id "12345" already exists');
    });

    // Postgres quotes mixed-case columns; the generic fallback hid which value collided.
    it('names a quoted camelCase column in a duplicate-key message', () => {
        const { body } = run(uniqueViolation('Key ("requestNumber")=(HR-2026-0010) already exists.'));

        expect(body.message).toBe('Request Number "HR-2026-0010" already exists');
    });

    it('falls back to a generic message for composite keys', () => {
        const { body } = run(uniqueViolation('Key ("scheduleId", "itemId")=(a, b) already exists.'));

        expect(body.message).toBe('A record with this value already exists');
    });
});
