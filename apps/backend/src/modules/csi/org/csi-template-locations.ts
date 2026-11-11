import { BadRequestException } from '@nestjs/common';

/** Locations that can hold an HC assignment template (code → display name). */
export const CSI_TEMPLATE_LOCATION_NAMES: Readonly<Record<string, string>> = { SMG: 'Semarang', SPJ: 'Sepanjang', KRW: 'Karawang', JTB: 'Jakarta' };

export type CsiTemplateLocation = { code: string; name: string };

/** Resolves a location code from a URL (any case); unknown codes are refused. */
export function csiTemplateLocation(locationCode: string): CsiTemplateLocation {
    const code = locationCode.toUpperCase();
    const name = CSI_TEMPLATE_LOCATION_NAMES[code];
    if (!name) throw new BadRequestException('Lokasi tidak dikenal');
    return { code, name };
}
