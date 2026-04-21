import { IsEnum } from 'class-validator';

export class ItemDeliveryDto {
  @IsEnum(['ARRIVED', 'PENDING'])
  status!: 'ARRIVED' | 'PENDING';
}