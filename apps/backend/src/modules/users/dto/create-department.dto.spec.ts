import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';

function parse(body: Record<string, unknown>) {
    const dto = plainToInstance(CreateDepartmentDto, body);
    return { dto, errors: validateSync(dto) };
}

describe('CreateDepartmentDto', () => {
    it('normalises the code to uppercase alphanumerics and trims the name', () => {
        const { dto, errors } = parse({ name: '  Human Capital ', code: 'h c-d' });

        expect(errors).toHaveLength(0);
        expect(dto).toEqual(expect.objectContaining({ name: 'Human Capital', code: 'HCD' }));
    });

    it.each(['X', 'TOOLONG', '&&'])('rejects code %p', (code) => {
        expect(parse({ name: 'Dept', code }).errors.map(e => e.property)).toContain('code');
    });

    it('requires a name', () => {
        expect(parse({ name: '   ', code: 'IT' }).errors.map(e => e.property)).toContain('name');
    });
});
