import { BadRequestException } from '@nestjs/common';

export type CsiTemplateLocation = { code: string; name: string; hint: string };

/** Locations that can hold an HC assignment template, in display order; the hint is the SJA plant name. */
export const CSI_TEMPLATE_LOCATIONS: ReadonlyArray<CsiTemplateLocation> = [
    { code: 'SPJ', name: 'Sepanjang', hint: 'SJA 1' },
    { code: 'KRW', name: 'Karawang', hint: 'SJA 2' },
    { code: 'SKD', name: 'Sukodono', hint: 'SJA 3' },
    { code: 'SMG', name: 'Semarang', hint: 'SJA Semarang' },
    { code: 'JTB', name: 'Jakarta', hint: 'SJA Jatibaru' },
];

/** Code → display name. */
export const CSI_TEMPLATE_LOCATION_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
    CSI_TEMPLATE_LOCATIONS.map(({ code, name }) => [code, name]),
);

/** Resolves a location code from a URL (any case); unknown codes are refused. */
export function csiTemplateLocation(locationCode: string): CsiTemplateLocation {
    const code = locationCode.toUpperCase();
    const location = CSI_TEMPLATE_LOCATIONS.find((row) => row.code === code);
    if (!location) throw new BadRequestException('Lokasi tidak dikenal');
    return { ...location };
}
