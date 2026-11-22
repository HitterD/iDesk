import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUUID, IsEnum, IsArray, IsIn, ArrayMaxSize, MaxLength } from 'class-validator';
import { EFormType } from '../entities/eform-request.entity';
import { SynologyAccountStatus } from '../eform-roles.constants';

/** Synology servers the form can pick (same ids as the NAS browser). */
export const NAS_SERVER_IDS = ['JKT', 'KRW', 'SMG', 'SPJ'] as const;
export type NasServerId = (typeof NAS_SERVER_IDS)[number];
const SYNOLOGY_ACCOUNT_NAME_MAX = 120;

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

  /** Synology: new account or an existing one; kept in `formData` so IT sees what to create or extend. */
  @IsEnum(SynologyAccountStatus)
  @IsOptional()
  synologyAccountStatus?: SynologyAccountStatus;

  @IsString()
  @MaxLength(SYNOLOGY_ACCOUNT_NAME_MAX)
  @IsOptional()
  synologyAccountName?: string;

  @IsArray()
  @ArrayMaxSize(NAS_SERVER_IDS.length)
  @IsIn(NAS_SERVER_IDS, { each: true })
  @IsOptional()
  selectedNasServers?: NasServerId[];

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

  /** Optional GM who approves in iDesk after the manager; picking one turns the GM step on. ICT may change it. */
  @IsUUID()
  @IsOptional()
  gmApproverId?: string;

  /** Completes a proposal IT drafted from a ticket instead of creating a new request. */
  @IsUUID()
  @IsOptional()
  draftId?: string;
}
