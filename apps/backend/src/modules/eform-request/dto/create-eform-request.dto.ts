import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUUID, IsEnum } from 'class-validator';
import { EFormType } from '../entities/eform-request.entity';

export class CreateEFormRequestDto {
  @IsEnum(EFormType)
  @IsNotEmpty()
  formType: EFormType;

  @IsString()
  @IsOptional()
  requesterName?: string;

  @IsString()
  @IsOptional()
  requesterDepartment?: string;

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

  /**
   * Required for every type except those that go straight to IT (Synology),
   * where there is no manager step. Enforced in the service, which knows the
   * form type.
   */
  @IsUUID()
  @IsOptional()
  managerId?: string;

  /** Completes a proposal IT drafted from a ticket instead of creating a new request. */
  @IsUUID()
  @IsOptional()
  draftId?: string;
}
