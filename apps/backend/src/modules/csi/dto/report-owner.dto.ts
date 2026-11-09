import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

const OWNERS_MAX = 50;

export class SetReportOwnersDto {
    @IsArray({ message: 'Daftar pengguna harus berupa array' })
    @ArrayMaxSize(OWNERS_MAX, { message: `Maksimal ${OWNERS_MAX} penanggung jawab per layanan` })
    @IsUUID('all', { each: true, message: 'ID pengguna harus berupa UUID' })
    userIds: string[];
}
