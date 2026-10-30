import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ValidationExceptionFilter } from './validation-exception.filter';

const buildHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, json };
};

describe('ValidationExceptionFilter', () => {
  it('should include the field message when a single field fails', () => {
    const { host, json } = buildHost();
    new ValidationExceptionFilter().catch(
      new BadRequestException(['Title must be at least 5 characters']),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Validation failed for Title: Title must be at least 5 characters',
      }),
    );
  });

  it('should summarise the field count when several fields fail', () => {
    const { host, json } = buildHost();
    new ValidationExceptionFilter().catch(
      new BadRequestException(['title must be a string', 'priority must be an enum']),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Validation failed for 2 fields' }),
    );
  });
});
