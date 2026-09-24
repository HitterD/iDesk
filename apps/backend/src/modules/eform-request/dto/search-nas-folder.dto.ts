import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchNasFolderDto {
  @ApiProperty({ description: 'ID Server Synology (JKT, KRW, SMG, SPJ)', example: 'SPJ' })
  @IsNotEmpty()
  @IsString()
  serverId: string;

  @ApiProperty({ description: 'Kata kunci pencarian folder', example: 'ict' })
  @IsNotEmpty()
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Batas kedalaman pencarian folder (default: 4)', example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  maxDepth?: number;
}
