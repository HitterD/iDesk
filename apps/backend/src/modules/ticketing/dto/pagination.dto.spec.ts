import { validate } from 'class-validator';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('should allow valid excludeCategory, startDate, and endDate', async () => {
    const dto = new PaginationDto();
    dto.excludeCategory = 'Hardware Request';
    dto.startDate = '2023-01-01T00:00:00.000Z';
    dto.endDate = '2023-12-31T23:59:59.999Z';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should catch invalid date formats', async () => {
    const dto = new PaginationDto();
    dto.startDate = 'invalid-date';
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('startDate');
  });
});
