import { IsBoolean } from 'class-validator';

export class SetPicActiveDto {
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive: boolean;
}
