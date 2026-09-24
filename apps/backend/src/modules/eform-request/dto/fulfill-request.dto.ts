import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/**
 * Fulfilment without credentials.
 *
 * Used when IT grants access to an account the requester already has — a
 * Synology shared-folder addition, for example. No username or password is
 * issued, so `notes` is where IT records what was actually granted.
 */
export class FulfillRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  accountName?: string;
}
