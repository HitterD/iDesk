import { ArgumentsHost, HttpStatus } from '@nestjs/common';
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
                getRequest: () => ({ url: '/v1/hardware-requests', method: 'POST' }),
            }),
        } as unknown as ArgumentsHost;
        new DatabaseExceptionFilter().catch(exception, host);
        return { statusCode: status.mock.calls[0][0], body: json.mock.calls[0][0] };
    };

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
