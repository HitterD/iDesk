import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** Units that reached IT's warehouse. */
export class ArrivalsDto {
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true })
    itemIds: string[];
}
