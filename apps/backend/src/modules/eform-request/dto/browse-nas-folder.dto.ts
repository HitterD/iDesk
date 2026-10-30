import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BrowseNasFolderDto {
  @ApiProperty({ description: 'ID Server Synology (JKT, KRW, SMG, SPJ)', example: 'SPJ' })
  @IsNotEmpty()
  @IsString()
  serverId: string;

  @ApiPropertyOptional({ description: 'Path folder untuk penjelajahan subfolder', example: '/Sharing/Dept_Keuangan' })
  @IsOptional()
  @IsString()
  path?: string;
}
