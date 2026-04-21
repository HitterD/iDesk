import { PartialType } from '@nestjs/swagger';
import { CreateRequestDto } from './create-request.dto';

export class UpdateDraftDto extends PartialType(CreateRequestDto) {}
