import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUUID, IsEnum } from 'class-validator';
import { EFormType } from '../entities/eform-request.entity';

export class CreateEFormRequestDto {
  @IsEnum(EFormType)
  @IsNotEmpty()
  formType: EFormType;

  @IsObject()
  @IsNotEmpty()
  formData: any;

  @IsString()
  @IsOptional()
  requestedWebsites?: string;

  @IsString()
  @IsOptional()
  networkPurpose?: string;

  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsString()
  @IsNotEmpty()
  signatureData: string;

  @IsUUID()
  @IsNotEmpty()
  managerId: string;
}
