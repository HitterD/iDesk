import { ArgumentsHost, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const buildHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url: '/api/tickets/t1/status' }) }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
};

describe('HttpExceptionFilter', () => {
  it('keeps business fields of an object-bodied 4xx so clients can branch on code', () => {
    const { host, json, status } = buildHost();
    new HttpExceptionFilter().catch(
      new ConflictException({ code: 'SOME_CODE', message: 'Butuh konfirmasi', currentAssignee: { id: 'a', fullName: 'A' } }),
      host,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 409,
      message: 'Butuh konfirmasi',
      code: 'SOME_CODE',
      currentAssignee: { id: 'a', fullName: 'A' },
      path: '/api/tickets/t1/status',
    }));
  });

  it('forwards the bulk takeover tickets list', () => {
    const { host, json } = buildHost();
    const tickets = [{ id: 't1', ticketNumber: 'N-1', currentAssignee: { id: 'a', fullName: 'A' } }];
    new HttpExceptionFilter().catch(new ConflictException({ code: 'SOME_CODE', message: 'x', tickets }), host);
    expect(json.mock.calls[0][0]).toEqual(expect.objectContaining({ code: 'SOME_CODE', tickets }));
  });

  it('drops body keys that are not allow-listed (e.g. login errorCode, renewal existingId)', () => {
    const { host, json } = buildHost();
    new HttpExceptionFilter().catch(
      new ConflictException({ message: 'x', errorCode: 'WRONG_PASSWORD', existingId: 'c1', existingVendor: 'V' }),
      host,
    );
    const body = json.mock.calls[0][0];
    expect(body).not.toHaveProperty('errorCode');
    expect(body).not.toHaveProperty('existingId');
    expect(body).not.toHaveProperty('existingVendor');
  });

  it('does not leak object fields of a 5xx', () => {
    const { host, json } = buildHost();
    new HttpExceptionFilter().catch(new InternalServerErrorException({ message: 'boom', secret: 'x', code: 'C' }), host);
    expect(json.mock.calls[0][0]).not.toHaveProperty('secret');
    expect(json.mock.calls[0][0]).not.toHaveProperty('code');
  });
});
