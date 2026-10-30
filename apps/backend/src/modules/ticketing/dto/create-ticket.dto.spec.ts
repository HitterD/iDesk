import { validate } from 'class-validator';
import { CreateTicketDto } from './create-ticket.dto';
import { TicketPriority } from '../entities/ticket.entity';

const buildDto = (title: string) => {
  const dto = new CreateTicketDto();
  dto.title = title;
  dto.description = 'Mohon dibantu untuk update kubikasi item barang jadi.';
  dto.priority = TicketPriority.HIGH;
  return dto;
};

describe('CreateTicketDto', () => {
  it.each([
    'Update Kubikasi Item Barang Jadi',
    'Delete akun lama; create user baru',
    'Select printer lantai 2 | error',
  ])('should accept ordinary title "%s"', async (title) => {
    const errors = await validate(buildDto(title));
    expect(errors).toEqual([]);
  });

  it('should still reject a title shorter than 5 characters', async () => {
    const errors = await validate(buildDto('abc'));
    expect(errors[0].property).toBe('title');
  });
});
