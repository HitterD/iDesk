import { IsString, MaxLength } from 'class-validator';
import { DOCUMENT_NUMBER_MAX } from '../eform-document-number';

export class UpdateDocumentNumberDto {
  /** Format is checked in EFormDocumentService after trimming, with a message the agent can act on. */
  @IsString()
  @MaxLength(DOCUMENT_NUMBER_MAX + 10)
  documentNumber: string;
}
