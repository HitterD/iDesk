import { BadRequestException } from '@nestjs/common';
import { CSI_TEMPLATE_LOCATIONS, CSI_TEMPLATE_LOCATION_NAMES, csiTemplateLocation } from './csi-template-locations';

describe('CSI template locations', () => {
    it('lists the five locations in order with their SJA hint', () => {
        expect(CSI_TEMPLATE_LOCATIONS).toEqual([
            { code: 'SPJ', name: 'Sepanjang', hint: 'SJA 1' },
            { code: 'KRW', name: 'Karawang', hint: 'SJA 2' },
            { code: 'SKD', name: 'Sukodono', hint: 'SJA 3' },
            { code: 'SMG', name: 'Semarang', hint: 'SJA Semarang' },
            { code: 'JTB', name: 'Jakarta', hint: 'SJA Jatibaru' },
        ]);
        expect(CSI_TEMPLATE_LOCATION_NAMES.SKD).toBe('Sukodono');
    });

    it('resolves a code in any case and refuses unknown codes', () => {
        expect(csiTemplateLocation('skd')).toEqual({ code: 'SKD', name: 'Sukodono', hint: 'SJA 3' });
        expect(() => csiTemplateLocation('XYZ')).toThrow(BadRequestException);
    });
});
