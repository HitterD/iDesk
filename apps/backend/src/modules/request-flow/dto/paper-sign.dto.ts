import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const QR_MAX = 200;

/** Text fields sent next to the scan (multipart `file`). */
export class PaperSignDto {
    /** What the QR on the scanned page reads, as decoded by the browser: `<ticketNumber>/v<N>`. */
    @IsString() @IsNotEmpty() @MaxLength(QR_MAX)
    qr: string;
}
