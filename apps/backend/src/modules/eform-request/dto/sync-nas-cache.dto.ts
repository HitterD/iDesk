import { IsIn, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class SyncNasCacheDto {
  @IsNotEmpty({ message: 'Server ID Synology harus disertakan' })
  @IsIn(['JKT', 'KRW', 'SMG', 'SPJ'], {
    message: 'Server ID harus salah satu dari: JKT, KRW, SMG, SPJ',
  })
  serverId!: 'JKT' | 'KRW' | 'SMG' | 'SPJ';

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
